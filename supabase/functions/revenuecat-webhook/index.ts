import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from 'cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? ''

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function hmacSHA256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function mapPlan(entitlementIds: string[] | undefined): 'free' | 'pro' | 'cloud' {
  const normalized = (entitlementIds ?? []).map((id) => id.toLowerCase())
  if (normalized.includes('cloud')) return 'cloud'
  if (normalized.includes('pro')) return 'pro'
  return 'free'
}

function mapStatus(eventType: string): string {
  const inactiveEvents = new Set([
    'CANCELLATION',
    'EXPIRATION',
    'SUBSCRIPTION_PAUSED',
    'BILLING_ISSUE',
    'UNCANCELLATION'
  ])
  return inactiveEvents.has(eventType.toUpperCase()) ? 'inactive' : 'active'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' })
  }

  const rawBody = await req.text()

  if (REVENUECAT_WEBHOOK_SECRET) {
    const authHeader = req.headers.get('Authorization') ?? ''
    const headerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()
    const rcSignature = req.headers.get('X-RevenueCat-Signature') ?? ''

    let valid = false
    if (headerSecret) {
      valid = timingSafeEqual(headerSecret, REVENUECAT_WEBHOOK_SECRET)
    } else if (rcSignature) {
      const computedHex = await hmacSHA256Hex(REVENUECAT_WEBHOOK_SECRET, rawBody)
      valid = timingSafeEqual(computedHex, rcSignature.toLowerCase())
    }

    if (!valid) {
      return respond(401, { error: 'Invalid RevenueCat webhook signature.' })
    }
  }

  const payload = JSON.parse(rawBody)
  const event = payload?.event ?? payload

  const userId = String(event?.app_user_id ?? '').trim()
  if (!isUUID(userId)) {
    return respond(400, { error: 'Invalid or missing app_user_id (must be UUID).' })
  }

  const entitlementIds: string[] = Array.isArray(event?.entitlement_ids)
    ? event.entitlement_ids.map((value: unknown) => String(value))
    : []

  const plan = mapPlan(entitlementIds)
  const status = mapStatus(String(event?.type ?? 'UNKNOWN'))
  const expiresAtMs = Number(event?.expiration_at_ms ?? event?.expires_at_ms ?? 0)
  const expiresAt = Number.isFinite(expiresAtMs) && expiresAtMs > 0
    ? new Date(expiresAtMs).toISOString()
    : null

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await serviceClient
    .from('mobile_subscription_state')
    .upsert({
      user_id: userId,
      plan,
      status,
      expires_at: expiresAt,
      source: 'revenuecat'
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('revenuecat-webhook upsert error', error)
    return respond(500, { error: 'Failed to sync subscription state.' })
  }

  return respond(200, { ok: true })
})
