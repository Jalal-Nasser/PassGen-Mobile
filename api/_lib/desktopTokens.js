const { supabase } = require('./supabase')
const { makeToken, hashToken, minutesFromNow, daysFromNow, nowIso } = require('./utils')

const ACCESS_TTL_MINUTES = parseInt(process.env.DESKTOP_ACCESS_TTL_MINUTES || '10', 10)
const REFRESH_TTL_DAYS = parseInt(process.env.DESKTOP_REFRESH_TTL_DAYS || '30', 10)

function getAccessTokenFromRequest(req) {
  const auth = String(req.headers.authorization || '')
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }
  return String(req.headers['x-passgen-session'] || '')
}

async function ensureRefreshToken(userId, deviceId, forceRotate = false) {
  const now = Date.now()
  const { data, error } = await supabase
    .from('devices')
    .select('refresh_token_hash, refresh_expires_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error) {
    throw new Error(`Device lookup failed: ${error.message}`)
  }

  const expiresAt = data?.refresh_expires_at ? new Date(data.refresh_expires_at).getTime() : 0
  if (!forceRotate && data?.refresh_token_hash && expiresAt > now) {
    return { refreshToken: null, refreshExpiresAt: data.refresh_expires_at }
  }

  const refreshToken = makeToken(32)
  const refreshExpiresAt = daysFromNow(REFRESH_TTL_DAYS)
  const { error: updateError } = await supabase
    .from('devices')
    .upsert({
      user_id: userId,
      device_id: deviceId,
      refresh_token_hash: hashToken(refreshToken),
      refresh_expires_at: refreshExpiresAt,
      last_seen_at: nowIso(),
      activated_at: nowIso()
    }, { onConflict: 'user_id,device_id' })

  if (updateError) {
    throw new Error(`Device refresh update failed: ${updateError.message}`)
  }

  return { refreshToken, refreshExpiresAt }
}

async function issueAccessToken(userId, deviceId) {
  const accessToken = makeToken(32)
  const accessExpiresAt = minutesFromNow(ACCESS_TTL_MINUTES)
  const { error } = await supabase.from('desktop_tokens').insert({
    user_id: userId,
    device_id: deviceId,
    token_hash: hashToken(accessToken),
    expires_at: accessExpiresAt,
    created_at: nowIso()
  })

  if (error) {
    throw new Error(`Access token insert failed: ${error.message}`)
  }

  return { accessToken, accessExpiresAt }
}

async function verifyAccessToken(token) {
  if (!token) return null
  const { data, error } = await supabase
    .from('desktop_tokens')
    .select('user_id, device_id, expires_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()

  if (error) {
    throw new Error(`Token lookup failed: ${error.message}`)
  }
  if (!data) return null

  const expiresAt = new Date(data.expires_at).getTime()
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    return null
  }

  return data
}

async function rotateRefreshToken(refreshToken, deviceId) {
  if (!refreshToken) return null
  const hashed = hashToken(refreshToken)
  const { data, error } = await supabase
    .from('devices')
    .select('user_id, refresh_expires_at')
    .eq('device_id', deviceId)
    .eq('refresh_token_hash', hashed)
    .maybeSingle()

  if (error) {
    throw new Error(`Refresh lookup failed: ${error.message}`)
  }
  if (!data) return null

  const expiresAt = new Date(data.refresh_expires_at).getTime()
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    return null
  }

  const newRefreshToken = makeToken(32)
  const newRefreshExpiresAt = daysFromNow(REFRESH_TTL_DAYS)
  const { error: updateError } = await supabase
    .from('devices')
    .update({
      refresh_token_hash: hashToken(newRefreshToken),
      refresh_expires_at: newRefreshExpiresAt,
      last_seen_at: nowIso()
    })
    .eq('user_id', data.user_id)
    .eq('device_id', deviceId)

  if (updateError) {
    throw new Error(`Refresh update failed: ${updateError.message}`)
  }

  return { userId: data.user_id, refreshToken: newRefreshToken, refreshExpiresAt: newRefreshExpiresAt }
}

module.exports = {
  getAccessTokenFromRequest,
  ensureRefreshToken,
  issueAccessToken,
  verifyAccessToken,
  rotateRefreshToken,
  ACCESS_TTL_MINUTES
}
