const { supabase } = require('../_lib/supabase')
const { readJson, sendJson, nowIso } = require('../_lib/utils')
const { requireDesktopSession, fetchSubscription } = require('../_lib/desktopAuth')

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

  const session = await requireDesktopSession(req)
  if (!session) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const deviceId = String(payload.deviceId || '').trim()
  if (!deviceId) {
    return sendJson(res, 400, { error: 'Missing deviceId' })
  }

  const { error } = await supabase
    .from('devices')
    .upsert({
      user_id: session.user_id,
      device_id: deviceId,
      activated_at: nowIso(),
      last_seen_at: nowIso()
    }, { onConflict: 'user_id,device_id' })

  if (error) {
    return sendJson(res, 500, { error: `Device update failed: ${error.message}` })
  }

  const subscription = await fetchSubscription(session.user_id)
  const plan = subscription?.plan || 'free'

  return sendJson(res, 200, {
    activated: true,
    isPremium: !!subscription,
    plan,
    expiresAt: subscription?.expires_at || null
  })
}
