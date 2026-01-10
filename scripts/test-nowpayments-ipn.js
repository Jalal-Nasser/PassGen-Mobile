#!/usr/bin/env node
/* eslint-disable no-console */

try { require('dotenv').config() } catch {}
const crypto = require('crypto')

const targetUrl = process.env.NOWPAYMENTS_TEST_URL || 'https://passgen.mdeploy.dev/api/nowpayments/webhook'
const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || ''

if (!ipnSecret) {
  console.error('NOWPAYMENTS_IPN_SECRET is missing. Set it in your environment.')
  process.exit(1)
}

const installId = process.env.NOWPAYMENTS_TEST_INSTALL_ID || '00000000-0000-0000-0000-000000000000'
const email = process.env.NOWPAYMENTS_TEST_EMAIL || 'test@example.com'
const plan = process.env.NOWPAYMENTS_TEST_PLAN || 'cloud'
const term = process.env.NOWPAYMENTS_TEST_TERM || 'yearly'

const payload = {
  payment_status: 'finished',
  payment_id: `test_${Date.now()}`,
  order_id: `order_${Date.now()}`,
  custom_fields: {
    email,
    plan,
    term,
    install_id: installId
  }
}

const body = JSON.stringify(payload)
const signature = crypto.createHmac('sha512', ipnSecret).update(body).digest('hex')

async function main() {
  console.log('[NOWPAYMENTS TEST] url=', targetUrl)
  console.log('[NOWPAYMENTS TEST] email=', email, 'plan=', plan, 'term=', term)
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': signature
    },
    body
  })
  const text = await response.text()
  console.log('[NOWPAYMENTS TEST] status=', response.status)
  console.log('[NOWPAYMENTS TEST] body=', text)
}

main().catch((error) => {
  console.error('[NOWPAYMENTS TEST] error:', error?.message || error)
  process.exit(1)
})
