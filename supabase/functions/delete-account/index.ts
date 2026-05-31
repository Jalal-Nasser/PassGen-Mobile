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

async function getUserFromAuthHeader(authHeader: string | null) {
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) {
    return null
  }
  return data.user
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

  const user = await getUserFromAuthHeader(req.headers.get('Authorization'))
  if (!user) {
    return respondError(401, 'unauthorized', 'Unauthorized')
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { error } = await serviceClient.auth.admin.deleteUser(user.id, false)
  if (error) {
    console.error('delete-account auth delete error', error)
    return respondError(500, 'server_error', 'Unable to delete account.')
  }

  return respond(200, { ok: true })
})
