#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const distDir = path.resolve('dist-ios')
const viteHtml = path.join(distDir, 'index.ios.html')
const capacitorHtml = path.join(distDir, 'index.html')
const runtimeConfigPath = path.join(distDir, 'passgen-runtime.json')

if (!fs.existsSync(viteHtml)) {
  console.error('Missing dist-ios/index.ios.html. Run vite build --mode ios first.')
  process.exit(1)
}

fs.copyFileSync(viteHtml, capacitorHtml)
fs.rmSync(viteHtml)
const runtimeConfig = {
  supabaseURL: process.env.IOS_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.IOS_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  revenueCatAPIKey: process.env.IOS_REVENUECAT_API_KEY || process.env.VITE_REVENUECAT_IOS_KEY || '',
  revenueCatProProductID: process.env.IOS_REVENUECAT_PRO_PRODUCT_ID || '',
  revenueCatCloudProductID: process.env.IOS_REVENUECAT_CLOUD_PRODUCT_ID || '',
  revenueCatProPackageID: process.env.IOS_REVENUECAT_PRO_PACKAGE_ID || '',
  revenueCatCloudPackageID: process.env.IOS_REVENUECAT_CLOUD_PACKAGE_ID || '',
  googleIOSClientID: process.env.IOS_GOOGLE_IOS_CLIENT_ID || process.env.VITE_GOOGLE_IOS_CLIENT_ID || '',
  googleReversedClientID: process.env.IOS_GOOGLE_REVERSED_CLIENT_ID || '',
  googleServerClientID: process.env.IOS_GOOGLE_SERVER_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  driveAppFolder: process.env.IOS_DRIVE_APP_FOLDER || 'PassGenVault'
}
fs.writeFileSync(runtimeConfigPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`)
console.log('Prepared dist-ios/index.html for Capacitor.')
