#!/usr/bin/env node
// Generate one-time PassGen license keys and (optionally) insert into Supabase.
// Usage:
//   node scripts/generate-license-keys.js --count 20 --plan cloud --termDays 180
// Env (optional):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

try { require('dotenv').config() } catch {}
const crypto = require('crypto')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--count' || a === '-c') args.count = argv[++i]
    else if (a === '--plan' || a === '-p') args.plan = argv[++i]
    else if (a === '--termDays' || a === '--term' || a === '-t') args.termDays = argv[++i]
    else if (a === '--dry') args.dry = true
  }
  return args
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/1/I/O
function randomChunk(length = 4) {
  let out = ''
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, ALPHABET.length)
    out += ALPHABET[idx]
  }
  return out
}

function generateKey() {
  return `PASSGEN-${randomChunk()}-${randomChunk()}-${randomChunk()}-${randomChunk()}`
}

function canonicalize(key) {
  return String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function hashKey(key) {
  return crypto.createHash('sha256').update(canonicalize(key)).digest('hex')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const count = Number(args.count || process.env.KEY_COUNT || 20)
  const plan = String(args.plan || process.env.KEY_PLAN || 'cloud').toLowerCase()
  const termDays = Number(args.termDays || process.env.KEY_TERM_DAYS || 180)
  const dry = !!args.dry

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error('Count must be a positive number')
  }

  const keys = new Set()
  while (keys.size < count) {
    keys.add(generateKey())
  }

  const rows = Array.from(keys).map((key) => ({
    key,
    key_hash: hashKey(key),
    plan,
    term_days: termDays,
    status: 'available'
  }))

  console.log(`Generated ${rows.length} license keys:`)
  rows.forEach((row, idx) => {
    console.log(`${String(idx + 1).padStart(2, '0')}. ${row.key}`)
  })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !supabaseKey) {
    console.log('\nSupabase credentials not found. Skipping insert.')
    console.log('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to insert keys.')
    return
  }
  if (dry) {
    console.log('\n--dry specified. Skipping insert.')
    return
  }

  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)
  const payload = rows.map(({ key, ...rest }) => rest)
  const { error } = await supabase.from('license_keys').insert(payload)
  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`)
  }
  console.log('\nInserted keys into Supabase (hashed only).')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
