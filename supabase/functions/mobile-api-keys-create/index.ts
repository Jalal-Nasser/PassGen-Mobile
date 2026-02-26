import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from 'cors'
import {
  MAX_ACTIVE_API_KEYS,
  activeApiKeyCountForUser,
  hashApiKey,
  requirePaidSubscriptionForUser,
  sanitizeApiKeyLabel
} from '../_shared/api_key_auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function respondError(status: number, code: string, error: string) {
  return respond(status, { ok: false, code, error })
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null
  }

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
    return respondError(405, 'method_not_allowed', 'Method not allowed')
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return respondError(500, 'server_error', 'Supabase runtime secrets are not configured.')
  }

  const authHeader = req.headers.get('Authorization')
  const userId = await getUserIdFromAuthHeader(authHeader)
  if (!userId) {
    return respondError(401, 'unauthorized', 'Unauthorized')
  }

  const body = await req.json().catch(() => ({})) as { label?: string }
  const label = sanitizeApiKeyLabel(body.label)

  const subscription = await requirePaidSubscriptionForUser(userId)
  if (!subscription.ok) {
    return respondError(subscription.status, subscription.code, subscription.error)
  }

  const activeCount = await activeApiKeyCountForUser(userId)
  if (!activeCount.ok) {
    return respondError(activeCount.status, activeCount.code, activeCount.error)
  }

  if (activeCount.data >= MAX_ACTIVE_API_KEYS) {
    return respondError(409, 'conflict', 'Maximum of 3 active API keys reached. Revoke one before creating another.')
  }

  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = base64UrlEncode(keyBytes)
  const apiKey = `pg_live_${token}`
  const keyHash = await hashApiKey(apiKey)
  const prefix = apiKey.slice(0, 16)

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: created, error } = await serviceClient
    .from('mobile_api_keys')
    .insert({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: prefix,
      label
    })
    .select('id, created_at')
    .single()

  if (error || !created) {
    console.error('mobile-api-keys-create insert error', error)
    return respondError(500, 'server_error', 'Failed to create API key.')
  }

  return respond(200, {
    ok: true,
    id: created.id,
    key: apiKey,
    prefix,
    created_at: created.created_at
  })
})
