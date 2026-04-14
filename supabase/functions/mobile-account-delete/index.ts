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

function respondError(status: number, code: string, error: string) {
  return respond(status, { ok: false, code, error })
}

async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
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

  const body = await req.json().catch(() => ({})) as { confirm?: boolean }
  if (body.confirm !== true) {
    return respondError(400, 'bad_request', 'Deletion confirmation is required.')
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await serviceClient.auth.admin.deleteUser(userId)

  if (error) {
    console.error('mobile-account-delete auth delete error', error)
    return respondError(500, 'server_error', 'Failed to delete account.')
  }

  return respond(200, {
    ok: true,
    deleted_user_id: userId
  })
})
