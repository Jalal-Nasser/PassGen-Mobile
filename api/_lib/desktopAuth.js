const { supabase } = require('./supabase')
const { getAccessTokenFromRequest, verifyAccessToken } = require('./desktopTokens')

async function requireDesktopSession(req) {
  const token = getAccessTokenFromRequest(req)
  if (!token) return null
  const session = await verifyAccessToken(token)
  if (!session) return null
  return { token, ...session }
}

async function fetchUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`User lookup failed: ${error.message}`)
  }
  return data
}

async function fetchSubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Subscription lookup failed: ${error.message}`)
  }

  if (!data) return null
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (expiresAt && expiresAt <= Date.now()) return null
  return data
}

module.exports = {
  requireDesktopSession,
  fetchUser,
  fetchSubscription
}
