import { corsHeaders } from 'cors'
import { authorizeRequestWithApiKey } from '../_shared/api_key_auth.ts'

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function respondError(status: number, code: string, error: string) {
  return respond(status, { ok: false, code, error })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respondError(405, 'method_not_allowed', 'Method not allowed')
  }

  const auth = await authorizeRequestWithApiKey(req)
  if (!auth.ok) {
    return respondError(auth.status, auth.code, auth.error)
  }

  return respond(200, {
    ok: true,
    user_id: auth.data.userId,
    key_id: auth.data.keyId,
    key_prefix: auth.data.keyPrefix,
    plan: auth.data.plan,
    label: auth.data.label
  })
})
