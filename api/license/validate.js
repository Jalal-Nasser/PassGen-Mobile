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
    payload = {}
  }

  const session = await requireDesktopSession(req)
  if (!session) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const deviceId = String(payload.deviceId || session.device_id || '').trim()
  if (deviceId) {
    await supabase
      .from('devices')
      .update({ last_seen_at: nowIso() })
      .eq('user_id', session.user_id)
      .eq('device_id', deviceId)
  }

  const subscription = await fetchSubscription(session.user_id)
  const plan = subscription?.plan || 'free'

  return sendJson(res, 200, {
    isPremium: !!subscription,
    plan,
    expiresAt: subscription?.expires_at || null
  })
}
