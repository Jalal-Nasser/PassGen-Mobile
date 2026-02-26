import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from 'cors'
import { requirePaidSubscriptionForUser } from '../_shared/api_key_auth.ts'

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

  const body = await req.json().catch(() => ({})) as { id?: string }
  const keyId = String(body.id ?? '').trim()
  if (!keyId) {
    return respondError(400, 'bad_request', 'Missing key id.')
  }

  const subscription = await requirePaidSubscriptionForUser(userId)
  if (!subscription.ok) {
    return respondError(subscription.status, subscription.code, subscription.error)
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await serviceClient
    .from('mobile_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('mobile-api-keys-revoke update error', error)
    return respondError(500, 'server_error', 'Failed to revoke API key.')
  }

  if (!data) {
    return respondError(404, 'not_found', 'API key not found or already revoked.')
  }

  return respond(200, {
    ok: true,
    revoked_id: data.id
  })
})
