const { supabase } = require('../_lib/supabase')
const { readJson, sendJson, nowIso, hashToken } = require('../_lib/utils')
const { requireDesktopSession, fetchSubscription } = require('../_lib/desktopAuth')

function normalizeKey(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

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

  const rawKey = normalizeKey(payload.licenseKey)
  if (!rawKey) {
    return sendJson(res, 400, { error: 'Missing licenseKey' })
  }
  const keyHash = hashToken(rawKey)

  const { data: keyRow, error: keyError } = await supabase
    .from('license_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (keyError) {
    return sendJson(res, 500, { error: `License lookup failed: ${keyError.message}` })
  }
  if (!keyRow) {
    return sendJson(res, 404, { error: 'Invalid license key' })
  }
  if (keyRow.status !== 'available' || keyRow.redeemed_at) {
    return sendJson(res, 409, { error: 'License key already redeemed' })
  }

  const plan = String(keyRow.plan || 'cloud').toLowerCase()
  const termDays = Number(keyRow.term_days || 180)
  const existing = await fetchSubscription(session.user_id).catch(() => null)

  const baseExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0
  const now = Date.now()
  const start = Math.max(baseExpiry || 0, now)
  const expiresAt = new Date(start + termDays * 24 * 60 * 60 * 1000).toISOString()

  if (existing?.id) {
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({ plan, status: 'active', expires_at: expiresAt })
      .eq('id', existing.id)
    if (subError) {
      return sendJson(res, 500, { error: `Subscription update failed: ${subError.message}` })
    }
  } else {
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({ user_id: session.user_id, plan, status: 'active', expires_at: expiresAt })
    if (subError) {
      return sendJson(res, 500, { error: `Subscription insert failed: ${subError.message}` })
    }
  }

  const deviceId = String(payload.deviceId || session.device_id || '').trim()
  if (deviceId) {
    await supabase
      .from('devices')
      .upsert({
        user_id: session.user_id,
        device_id: deviceId,
        activated_at: nowIso(),
        last_seen_at: nowIso()
      }, { onConflict: 'user_id,device_id' })
  }

  const { error: redeemError } = await supabase
    .from('license_keys')
    .update({
      status: 'redeemed',
      redeemed_at: nowIso(),
      redeemed_by_user_id: session.user_id,
      redeemed_device_id: deviceId || null
    })
    .eq('id', keyRow.id)

  if (redeemError) {
    return sendJson(res, 500, { error: `License redeem failed: ${redeemError.message}` })
  }

  return sendJson(res, 200, {
    isPremium: true,
    plan,
    expiresAt
  })
}
