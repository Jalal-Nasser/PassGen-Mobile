#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const distDir = path.resolve('dist-ios')
const viteHtml = path.join(distDir, 'index.ios.html')
const capacitorHtml = path.join(distDir, 'index.html')

if (!fs.existsSync(viteHtml)) {
  console.error('Missing dist-ios/index.ios.html. Run vite build --mode ios first.')
  process.exit(1)
}

fs.copyFileSync(viteHtml, capacitorHtml)
fs.rmSync(viteHtml)
console.log('Prepared dist-ios/index.html for Capacitor.')
