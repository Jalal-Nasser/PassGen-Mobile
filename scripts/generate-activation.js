#!/usr/bin/env node
// Generate a Premium activation code for PassGen
// Usage:
//   npm run gen:activation -- --install <INSTALL_ID> --email <EMAIL> [--secret <SECRET>]
// Secrets precedence:
//   1) --secret CLI arg
//   2) SELLER_SECRET env
//   3) VITE_SELLER_SECRET env (for consistency with build-time secret)
//   4) Fallback "PG-SEC-2025" (not recommended for production)
// If .env exists, we load it automatically so VITE_SELLER_SECRET or SELLER_SECRET can be defined there.

try { require('dotenv').config() } catch {}
const crypto = require('crypto')
const readline = require('readline')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--install' || a === '-i') args.install = argv[++i]
    else if (a === '--email' || a === '-e') args.email = argv[++i]
    else if (a === '--secret' || a === '-s') args.secret = argv[++i]
  }
  return args
}

function computeCode(installId, email, secret) {
  const data = `${installId}|${(email || '').trim().toLowerCase()}|${secret}`
  const digest = crypto.createHash('sha256').update(data).digest('hex')
  return digest.substring(0, 10).toUpperCase()
}

(async () => {
  const args = parseArgs(process.argv.slice(2))
  let installId = args.install || process.env.INSTALL_ID
  let email = args.email || process.env.EMAIL
  const clean = (s) => (s || '').replace(/\s+#.*$/, '').trim()
  const secret = args.secret || clean(process.env.SELLER_SECRET) || clean(process.env.VITE_SELLER_SECRET) || 'PG-SEC-2025'

  // Interactive fallback if args/env not provided (helps on Windows npm where flags may not pass through)
  if (!installId || !email) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const ask = (q) => new Promise((res) => rl.question(q, (ans) => res(ans.trim())))
    if (!installId) installId = await ask('Install/Request ID: ')
    if (!email) email = await ask('User Email: ')
    rl.close()
  }

  if (!args.secret && !process.env.SELLER_SECRET && !process.env.VITE_SELLER_SECRET) {
    console.warn('[warn] No secret provided via --secret, SELLER_SECRET, or VITE_SELLER_SECRET. Using fallback "PG-SEC-2025".')
  }

  const code = computeCode(installId, email, secret)
  console.log('Activation Code:', code)
  console.log('\nInputs:')
  console.log('  Install/Request ID:', installId)
  console.log('  User Email:', email.trim().toLowerCase())
  console.log('  Secret: ', secret === 'PG-SEC-2025' ? '(default fallback PG-SEC-2025)' : '(provided)')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
