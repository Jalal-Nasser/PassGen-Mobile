const { supabase } = require('./_lib/supabase')
const { getBaseUrl } = require('./_lib/utils')

module.exports = async (req, res) => {
  try {
    if (!supabase) {
      return respondJson(res, 500, { error: 'Supabase not configured' })
    }
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const secret = process.env.AUTH_SECRET

    if (!clientId || !clientSecret || !secret) {
      return respondJson(res, 500, { error: 'Missing Auth.js configuration' })
    }

    const request = await toRequest(req)
    const { Auth } = await import('@auth/core')
    const GoogleProvider = await import('@auth/core/providers/google')
    const Google = GoogleProvider.default || GoogleProvider
    const response = await Auth(request, {
      trustHost: true,
      secret,
      providers: [
        Google({ clientId, clientSecret })
      ],
      session: { strategy: 'jwt' },
      callbacks: {
        async jwt({ token, user }) {
          if (!token.userId && user?.email) {
            const record = await upsertUser(user.email)
            token.userId = record.id
          }
          return token
        },
        async session({ session, token }) {
          if (token?.userId) {
            session.user = { ...(session.user || {}), id: token.userId }
          }
          return session
        }
      }
    })

    await sendResponse(res, response)
  } catch (error) {
    console.error('Auth handler error:', error)
    respondJson(res, 500, { error: error.message || 'Auth failed' })
  }
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

async function toRequest(req) {
  const url = new URL(req.url || '/', getBaseUrl(req))
  if (url.pathname === '/api/auth' && url.searchParams.has('path')) {
    const rawPath = url.searchParams.get('path') || ''
    const normalized = rawPath.split('/').filter(Boolean).join('/')
    url.searchParams.delete('path')
    url.pathname = `/api/auth/${normalized}`
  }
  const body = await readBody(req)
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined
  })
}

async function sendResponse(res, response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  const body = await response.text()
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve(null)
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function respondJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}
