import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type PaidPlan = 'pro' | 'cloud'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export const MAX_ACTIVE_API_KEYS = 3

export interface ServiceError {
  ok: false
  status: number
  code: string
  error: string
}

interface ServiceSuccess<T> {
  ok: true
  data: T
}

type ServiceResult<T> = ServiceSuccess<T> | ServiceError

interface ApiKeyLookup {
  id: string
  user_id: string
  key_prefix: string
  label: string
}

function serviceClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

function failure(status: number, code: string, error: string): ServiceError {
  return { ok: false, status, code, error }
}

function parsePaidPlan(value: string): PaidPlan | null {
  if (value === 'pro' || value === 'cloud') {
    return value
  }
  return null
}

export function sanitizeApiKeyLabel(rawLabel?: string): string {
  const base = (rawLabel ?? 'mobile').trim()
  const asciiSafe = base
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const trimmed = asciiSafe.slice(0, 64)
  return trimmed.length > 0 ? trimmed : 'mobile'
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const trimmed = authHeader.trim()
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null
  const token = trimmed.slice(7).trim()
  return token.length > 0 ? token : null
}

export function extractApiKeyFromHeaders(headers: Headers): string | null {
  const directHeader = (headers.get('x-passgen-api-key') ?? '').trim()
  if (directHeader.startsWith('pg_live_')) {
    return directHeader
  }

  const bearer = extractBearerToken(headers.get('Authorization'))
  if (bearer && bearer.startsWith('pg_live_')) {
    return bearer
  }

  return null
}

export async function hashApiKey(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function requirePaidSubscription(
  client: SupabaseClient,
  userId: string
): Promise<ServiceResult<{ plan: PaidPlan }>> {
  const { data: subscriptionState, error } = await client
    .from('mobile_subscription_state')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('subscription lookup error', error)
    return failure(500, 'server_error', 'Unable to verify subscription state.')
  }

  const plan = parsePaidPlan(String(subscriptionState?.plan ?? 'free').toLowerCase())
  const status = String(subscriptionState?.status ?? 'inactive').toLowerCase()
  if (!plan || status !== 'active') {
    return failure(403, 'forbidden', 'API keys require active PRO or CLOUD plan.')
  }

  return { ok: true, data: { plan } }
}

export async function requirePaidSubscriptionForUser(userId: string): Promise<ServiceResult<{ plan: PaidPlan }>> {
  const client = serviceClient()
  if (!client) {
    return failure(500, 'server_error', 'Supabase service configuration is missing.')
  }

  return requirePaidSubscription(client, userId)
}

export async function activeApiKeyCountForUser(userId: string): Promise<ServiceResult<number>> {
  const client = serviceClient()
  if (!client) {
    return failure(500, 'server_error', 'Supabase service configuration is missing.')
  }

  const { count, error } = await client
    .from('mobile_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (error) {
    console.error('active key count error', error)
    return failure(500, 'server_error', 'Unable to count active API keys.')
  }

  return { ok: true, data: count ?? 0 }
}

export async function authorizeRequestWithApiKey(
  req: Request
): Promise<ServiceResult<{ userId: string; keyId: string; keyPrefix: string; label: string; plan: PaidPlan }>> {
  const client = serviceClient()
  if (!client) {
    return failure(500, 'server_error', 'Supabase service configuration is missing.')
  }

  const apiKey = extractApiKeyFromHeaders(req.headers)
  if (!apiKey) {
    return failure(401, 'unauthorized', 'Missing API key.')
  }

  const keyHash = await hashApiKey(apiKey)
  const { data: keyRow, error: keyError } = await client
    .from('mobile_api_keys')
    .select('id, user_id, key_prefix, label')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (keyError) {
    console.error('api key lookup error', keyError)
    return failure(500, 'server_error', 'Unable to verify API key.')
  }

  if (!keyRow) {
    return failure(401, 'unauthorized', 'Invalid or revoked API key.')
  }

  const typedKeyRow = keyRow as ApiKeyLookup

  const subscription = await requirePaidSubscription(client, typedKeyRow.user_id)
  if (!subscription.ok) {
    return subscription
  }

  const { error: touchError } = await client
    .from('mobile_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', typedKeyRow.id)
    .eq('user_id', typedKeyRow.user_id)

  if (touchError) {
    console.error('api key touch error', touchError)
    return failure(500, 'server_error', 'Unable to update API key usage metadata.')
  }

  return {
    ok: true,
    data: {
      userId: typedKeyRow.user_id,
      keyId: typedKeyRow.id,
      keyPrefix: typedKeyRow.key_prefix,
      label: typedKeyRow.label,
      plan: subscription.data.plan
    }
  }
}
