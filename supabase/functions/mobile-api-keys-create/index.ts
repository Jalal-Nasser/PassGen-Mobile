import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from 'cors'

type ApiError = { error: string }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required Supabase env secrets for mobile-api-keys-create')
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return toHex(new Uint8Array(digest))
}

function unauthorized(message = 'Unauthorized') {
  return respond(401, { error: message } satisfies ApiError)
}

async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' } satisfies ApiError)
  }

  const authHeader = req.headers.get('Authorization')
  const userId = await getUserIdFromAuthHeader(authHeader)
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => ({})) as { label?: string }
  const label = (body.label || 'mobile').slice(0, 64)

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: subscriptionState } = await serviceClient
    .from('mobile_subscription_state')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()

  const plan = subscriptionState?.plan ?? 'free'
  const status = subscriptionState?.status ?? 'inactive'
  if (!(plan === 'pro' || plan === 'cloud') || status !== 'active') {
    return respond(403, { error: 'API keys require active PRO or CLOUD plan.' } satisfies ApiError)
  }

  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = base64UrlEncode(keyBytes)
  const apiKey = `pg_live_${token}`
  const keyHash = await sha256Hex(apiKey)
  const prefix = apiKey.slice(0, 16)

  const { error } = await serviceClient
    .from('mobile_api_keys')
    .insert({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: prefix,
      label
    })

  if (error) {
    console.error('mobile-api-keys-create insert error', error)
    return respond(500, { error: 'Failed to create API key.' } satisfies ApiError)
  }

  return respond(200, { key: apiKey, prefix })
})
