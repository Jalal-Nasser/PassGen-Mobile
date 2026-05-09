#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const roots = process.argv.slice(2)

if (!roots.length) {
  console.error('Usage: node scripts/validate-ios-artifact.js <dir> [dir...]')
  process.exit(2)
}

const blocked = [
  { label: 'license key', pattern: /license\s*key/i },
  { label: 'licenseRedeem', pattern: /licenseRedeem/i },
  { label: 'seller secret env', pattern: /VITE_SELLER_SECRET|SELLER_SECRET|PASSGEN_SELLER_SECRET/i },
  { label: 'seller secret wording', pattern: /seller\s+secret/i },
  { label: 'payment page', pattern: /payment\s*page/i },
  { label: 'external payment', pattern: /external\s+payment/i },
  { label: 'stripe', pattern: /\bstripe\b/i },
  { label: 'checkout', pattern: /\bcheckout\b/i },
  { label: 'paypal', pattern: /\bpaypal\b/i },
  { label: 'bitcoin', pattern: /\bbitcoin\b/i },
  { label: 'crypto payment', pattern: /crypto.{0,24}payment|payment.{0,24}crypto/i },
  { label: 'redeem', pattern: /\bredeem(?:ing|ed)?\b/i },
  { label: 'activation', pattern: /\bactivation\b/i },
  { label: 'dashboard', pattern: /\bdashboard\b/i },
  { label: 'git.mdeploy.dev', pattern: /git\.mdeploy\.dev/i },
  { label: 'premium unlock', pattern: /premium.{0,24}unlock|unlock.{0,24}premium/i },
  { label: 'pick a plan', pattern: /pick\s+a\s+plan/i },
  { label: 'open payment', pattern: /open\s+payment/i },
  { label: 'buy on website', pattern: /buy.{0,24}website|website.{0,24}buy/i }
]

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.xml'
])

function collectFiles(dir) {
  const files = []
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath))
      continue
    }

    if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath)
    }
  }

  return files
}

const findings = []

for (const root of roots) {
  const resolvedRoot = path.resolve(root)
  if (!fs.existsSync(resolvedRoot)) {
    findings.push({ file: resolvedRoot, label: 'missing artifact directory' })
    continue
  }

  for (const file of collectFiles(resolvedRoot)) {
    const text = fs.readFileSync(file, 'utf8')
    for (const rule of blocked) {
      if (rule.pattern.test(text)) {
        findings.push({ file, label: rule.label })
      }
    }
  }
}

if (findings.length) {
  console.error('iOS artifact validation failed. Remove external payment/license strings from iOS web assets:')
  for (const finding of findings) {
    console.error(`- ${finding.label}: ${path.relative(process.cwd(), finding.file)}`)
  }
  process.exit(1)
}

console.log('iOS artifact validation passed.')
