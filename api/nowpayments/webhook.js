const crypto = require('crypto')
const { supabase } = require('../_lib/supabase')
const { sendJson } = require('../_lib/utils')

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || ''
const LICENSE_SECRET = process.env.NOWPAYMENTS_LICENSE_SECRET || NOWPAYMENTS_IPN_SECRET || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RAW_FROM_EMAIL = process.env.FROM_EMAIL
const RAW_REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'activation@mdeploy.dev'
const DEFAULT_FROM_EMAIL = 'PassGen <activation@mdeploy.dev>'
const FROM_EMAIL = normalizeFromAddress(RAW_FROM_EMAIL) || DEFAULT_FROM_EMAIL
const REPLY_TO_EMAIL = isValidEmail(RAW_REPLY_TO_EMAIL) ? RAW_REPLY_TO_EMAIL : undefined
const MONTHLY_DAYS = Number(process.env.PASSGEN_TERM_MONTH_DAYS || 30)
const YEARLY_DAYS = Number(process.env.PASSGEN_TERM_YEAR_DAYS || 365)
const DEFAULT_TERM_DAYS = Number(process.env.PASSGEN_DEFAULT_TERM_DAYS || process.env.PASSGEN_PREMIUM_DAYS || 180)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || ''

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }
  if (!supabase) {
    return sendJson(res, 500, { error: 'Supabase not configured' })
  }
  if (!NOWPAYMENTS_IPN_SECRET) {
    return sendJson(res, 500, { error: 'NOWPayments IPN secret is not configured' })
  }

  let rawBody = ''
  try {
    rawBody = await readRawBody(req)
  } catch {
    return sendJson(res, 400, { error: 'Unable to read request body' })
  }

  const signature = String(req.headers['x-nowpayments-sig'] || req.headers['x-nowpayments-signature'] || '')
  if (!signature || !verifySignature(rawBody, signature, NOWPAYMENTS_IPN_SECRET)) {
    return sendJson(res, 401, { error: 'Invalid signature' })
  }

  let payload
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON' })
  }

  const status = String(payload.payment_status || payload.status || '').toLowerCase()
  if (!['finished', 'confirmed'].includes(status)) {
    return sendJson(res, 200, { ok: true, ignored: true, status })
  }

  const meta = extractMetadata(payload)
  const email = normalizeEmail(meta.email || payload.customer_email || payload.buyer_email || payload.email || meta.customer_email)
  if (!email) {
    return sendJson(res, 400, { error: 'Missing customer email' })
  }

  const plan = normalizePlan(meta.plan || meta.tier || meta.package || payload.plan)
  const termDays = resolveTermDays(meta)
  const installId = normalizeInstallId(meta.install_id || meta.installid || meta.device_id || extractInstallId(meta._rawText))
  const seed = String(payload.payment_id || payload.purchase_id || payload.invoice_id || payload.order_id || email || '')

  const licenseKey = seed && LICENSE_SECRET ? generateKeyFromSeed(seed, LICENSE_SECRET) : generateRandomKey()
  const keyHash = hashKey(licenseKey)

  const { data: existing, error: lookupError } = await supabase
    .from('license_keys')
    .select('id, key_hash')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (lookupError) {
    return sendJson(res, 500, { error: `License lookup failed: ${lookupError.message}` })
  }

  if (!existing) {
    const { error: insertError } = await supabase
      .from('license_keys')
      .insert({
        key_hash: keyHash,
        plan,
        term_days: termDays,
        status: 'available'
      })
    if (insertError) {
      return sendJson(res, 500, { error: `License insert failed: ${insertError.message}` })
    }
  }

  const emailOk = await sendLicenseEmail(email, licenseKey, plan, termDays, installId)
  if (!emailOk) {
    return sendJson(res, 500, { error: 'Failed to send license email' })
  }

  if (DISCORD_WEBHOOK_URL) {
    await postDiscordNotification({
      email,
      plan,
      termDays,
      installId,
      orderId: payload.order_id || '',
      licenseKey
    }).catch(() => {})
  }

  return sendJson(res, 200, {
    ok: true,
    status,
    email,
    plan,
    termDays,
    keyLast4: licenseKey.slice(-4)
  })
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function verifySignature(rawBody, signature, secret) {
  try {
    const digest = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
    const sig = signature.trim()
    if (!sig || sig.length !== digest.length) return false
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest))
  } catch {
    return false
  }
}

function extractMetadata(payload) {
  const meta = {}
  const rawChunks = []

  const addObject = (value) => {
    if (!value) return
    if (typeof value === 'string') {
      const parsed = parseJsonMaybe(value)
      if (parsed && typeof parsed === 'object') Object.assign(meta, parsed)
      Object.assign(meta, parseKeyValueText(value))
      rawChunks.push(value)
      return
    }
    if (typeof value === 'object') {
      Object.assign(meta, value)
      return
    }
  }

  addObject(payload.custom_fields)
  addObject(payload.custom)
  addObject(payload.metadata)
  addObject(payload.extra_data)

  const orderDesc = String(payload.order_description || '')
  const orderId = String(payload.order_id || '')
  if (orderDesc) {
    addObject(orderDesc)
  }
  if (orderId) {
    addObject(orderId)
  }

  const rawText = [orderDesc, orderId].filter(Boolean).join(' ')
  if (rawText) {
    rawChunks.push(rawText)
  }
  meta._rawText = rawChunks.join(' ')
  return meta
}

function parseJsonMaybe(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function parseKeyValueText(text) {
  const out = {}
  const trimmed = String(text || '').trim()
  if (!trimmed) return out

  if (trimmed.includes('&') && trimmed.includes('=')) {
    try {
      const params = new URLSearchParams(trimmed)
      params.forEach((value, key) => {
        out[key.toLowerCase()] = value
      })
      return out
    } catch {}
  }

  const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^;,\n]+)/g
  let match
  while ((match = regex.exec(trimmed)) !== null) {
    out[match[1].toLowerCase()] = match[2].trim()
  }
  return out
}

function normalizePlan(value) {
  const plan = String(value || 'cloud').toLowerCase()
  if (plan === 'byos' || plan === 'power') return 'byos'
  if (plan === 'pro' || plan === 'cloud') return plan
  return 'cloud'
}

function resolveTermDays(meta) {
  const direct = Number(meta.term_days || meta.termDays || meta.duration_days || meta.durationDays)
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct)
  const term = String(meta.term || meta.billing || meta.period || meta.interval || '').toLowerCase()
  if (term.includes('year') || term === 'annual' || term === 'yearly' || term === 'y') return YEARLY_DAYS
  if (term.includes('month') || term === 'monthly' || term === 'm') return MONTHLY_DAYS
  return DEFAULT_TERM_DAYS
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  return isValidEmail(email) ? email : ''
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''))
}

function normalizeInstallId(value) {
  const installId = String(value || '').trim()
  return installId
}

function extractInstallId(text) {
  const match = String(text || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return match ? match[0] : ''
}

function normalizeFromAddress(value) {
  if (!value) return ''
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('<') && trimmed.includes('>')) return trimmed
  if (isValidEmail(trimmed)) return `PassGen <${trimmed}>`
  return ''
}

function generateRandomKey() {
  return `PASSGEN-${randomChunk()}-${randomChunk()}-${randomChunk()}-${randomChunk()}`
}

function generateKeyFromSeed(seed, secret) {
  const hash = crypto.createHmac('sha256', secret).update(String(seed)).digest()
  const token = encodeBase32(hash, 16)
  return `PASSGEN-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}-${token.slice(12, 16)}`
}

function randomChunk(length = 4) {
  let out = ''
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, ALPHABET.length)
    out += ALPHABET[idx]
  }
  return out
}

function encodeBase32(buffer, length) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5 && output.length < length) {
      const index = (value >> (bits - 5)) & 31
      bits -= 5
      output += ALPHABET[index]
    }
  }
  if (output.length < length && bits > 0) {
    const index = (value << (5 - bits)) & 31
    output += ALPHABET[index]
  }
  return output.slice(0, length)
}

function canonicalizeKey(key) {
  return String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function hashKey(key) {
  return crypto.createHash('sha256').update(canonicalizeKey(key)).digest('hex')
}

async function sendLicenseEmail(email, licenseKey, plan, termDays, installId) {
  if (!RESEND_API_KEY) return false
  try {
    const { Resend } = require('resend')
    const resend = new Resend(RESEND_API_KEY)
    const planLabel = String(plan || 'cloud').toUpperCase()
    const termLabel = termDays >= 365 ? '1 year' : termDays >= 30 ? `${termDays} days` : `${termDays} days`
    const installBlock = installId ? `<p><strong>Install ID:</strong> ${installId}</p>` : ''
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">PassGen License Key</h2>
        <p>Thank you for your purchase. Here is your license key:</p>
        <div style="background: #f5f3ff; padding: 16px; border-radius: 10px; margin: 16px 0;">
          <div style="font-size: 18px; font-weight: bold; color: #5b21b6; letter-spacing: 1px;">${licenseKey}</div>
        </div>
        <p><strong>Plan:</strong> ${planLabel}</p>
        <p><strong>Term:</strong> ${termLabel} (from activation)</p>
        ${installBlock}
        <ol>
          <li>Open PassGen</li>
          <li>Go to Upgrade → Enter license key</li>
          <li>Click "Redeem Key"</li>
        </ol>
        <p>If you have any issues, reply to this email.</p>
      </div>
    `
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your PassGen License Key',
      reply_to: REPLY_TO_EMAIL,
      html: htmlBody
    })
    return true
  } catch (error) {
    console.error('License email failed:', error?.message || error)
    return false
  }
}

async function postDiscordNotification({ email, plan, termDays, installId, orderId, licenseKey }) {
  if (!DISCORD_WEBHOOK_URL) return
  const payload = {
    embeds: [
      {
        title: 'PassGen Payment Confirmed',
        color: 0x7c3aed,
        fields: [
          { name: 'Email', value: email || '-', inline: false },
          { name: 'Plan', value: String(plan || 'cloud'), inline: true },
          { name: 'Term (days)', value: String(termDays || ''), inline: true },
          { name: 'Install ID', value: installId || '-', inline: false },
          { name: 'Order ID', value: String(orderId || '-'), inline: false },
          { name: 'License Key', value: licenseKey ? `\`${licenseKey}\`` : '-', inline: false }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  }
  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}
