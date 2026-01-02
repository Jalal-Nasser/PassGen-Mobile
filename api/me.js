const { supabase } = require('./_lib/supabase')
const { sendJson, nowIso } = require('./_lib/utils')
const { requireDesktopSession, fetchUser, fetchSubscription } = require('./_lib/desktopAuth')

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }
  if (!supabase) {
    return sendJson(res, 500, { error: 'Supabase not configured' })
  }

  const session = await requireDesktopSession(req)
  if (!session) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const user = await fetchUser(session.user_id)
  if (!user) {
    return sendJson(res, 404, { error: 'User not found' })
  }

  const subscription = await fetchSubscription(session.user_id)
  const plan = subscription?.plan || 'free'
  const expiresAt = subscription?.expires_at || null
  const isPremium = !!subscription

  await supabase
    .from('devices')
    .update({ last_seen_at: nowIso() })
    .eq('user_id', session.user_id)
    .eq('device_id', session.device_id)

  return sendJson(res, 200, {
    userId: user.id,
    email: user.email,
    plan,
    isPremium,
    expiresAt
  })
}
