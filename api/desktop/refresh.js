const { supabase } = require('../_lib/supabase')
const { readJson, sendJson } = require('../_lib/utils')
const { rotateRefreshToken, issueAccessToken } = require('../_lib/desktopTokens')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }
  if (!supabase) {
    return sendJson(res, 500, { error: 'Supabase not configured' })
  }

  let payload
  try {
    payload = await readJson(req)
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON' })
  }

  const refreshToken = String(payload.refreshToken || '').trim()
  const deviceId = String(payload.deviceId || '').trim()
  if (!refreshToken || !deviceId) {
    return sendJson(res, 400, { error: 'Missing refreshToken or deviceId' })
  }

  const rotated = await rotateRefreshToken(refreshToken, deviceId)
  if (!rotated) {
    return sendJson(res, 401, { error: 'Invalid refresh token' })
  }

  const { accessToken, accessExpiresAt } = await issueAccessToken(rotated.userId, deviceId)

  return sendJson(res, 200, {
    accessToken,
    accessExpiresAt,
    refreshToken: rotated.refreshToken,
    refreshExpiresAt: rotated.refreshExpiresAt
  })
}
