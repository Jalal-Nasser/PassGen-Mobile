import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from 'cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
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
    return respond(405, { error: 'Method not allowed' })
  }

  const authHeader = req.headers.get('Authorization')
  const userId = await getUserIdFromAuthHeader(authHeader)
  if (!userId) {
    return respond(401, { error: 'Unauthorized' })
  }

  const body = await req.json().catch(() => ({})) as { id?: string }
  if (!body.id) {
    return respond(400, { error: 'Missing key id.' })
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: subscriptionState } = await serviceClient
    .from('mobile_subscription_state')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()

  const plan = subscriptionState?.plan ?? 'free'
  const status = subscriptionState?.status ?? 'inactive'
  if (!(plan === 'pro' || plan === 'cloud') || status !== 'active') {
    return respond(403, { error: 'API keys require active PRO or CLOUD plan.' })
  }

  const { error } = await serviceClient
    .from('mobile_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', userId)

  if (error) {
    console.error('mobile-api-keys-revoke update error', error)
    return respond(500, { error: 'Failed to revoke API key.' })
  }

  return respond(200, { ok: true })
})
