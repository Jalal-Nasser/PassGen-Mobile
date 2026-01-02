const { supabase } = require('../_lib/supabase')
const { getBaseUrl, sendJson } = require('../_lib/utils')
const { ensureRefreshToken, issueAccessToken } = require('../_lib/desktopTokens')

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }
  if (!supabase) {
    return sendJson(res, 500, { error: 'Supabase not configured' })
  }

  const secret = process.env.AUTH_SECRET
  if (!secret) {
    return sendJson(res, 500, { error: 'Missing AUTH_SECRET' })
  }

  const url = new URL(req.url || '/', getBaseUrl(req))
  const deviceId = url.searchParams.get('device')
  if (!deviceId) {
    return sendJson(res, 400, { error: 'Missing device parameter' })
  }

  const { getToken } = await import('@auth/core/jwt')
  const sessionToken = await getToken({ req, secret })
  if (!sessionToken || !sessionToken.email) {
    const callbackUrl = `${getBaseUrl(req)}/desktop/login?device=${encodeURIComponent(deviceId)}`
    const signinUrl = `${getBaseUrl(req)}/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
    res.statusCode = 302
    res.setHeader('Location', signinUrl)
    return res.end()
  }

  const user = await upsertUser(sessionToken.email)
  const { refreshToken, refreshExpiresAt } = await ensureRefreshToken(user.id, deviceId, true)
  const { accessToken, accessExpiresAt } = await issueAccessToken(user.id, deviceId)

  const redirectUrl = new URL('passgen://auth-callback')
  redirectUrl.searchParams.set('device', deviceId)
  redirectUrl.searchParams.set('token', accessToken)
  redirectUrl.searchParams.set('expires', accessExpiresAt)
  if (refreshToken) {
    redirectUrl.searchParams.set('refresh', refreshToken)
    redirectUrl.searchParams.set('refreshExpires', refreshExpiresAt)
  }
  res.statusCode = 302
  res.setHeader('Location', redirectUrl.toString())
  return res.end()
}

async function upsertUser(email) {
  const normalized = String(email || '').trim().toLowerCase()
  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalized)
    .maybeSingle()

  if (lookupError) {
    throw new Error(`User lookup failed: ${lookupError.message}`)
  }

  if (existing) return existing

  const { data, error } = await supabase
    .from('users')
    .insert({ email: normalized })
    .select()
    .single()

  if (error) {
    throw new Error(`User create failed: ${error.message}`)
  }

  return data
}
