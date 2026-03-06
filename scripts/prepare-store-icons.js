const fs = require('fs')
const path = require('path')

async function ensureStoreIcons() {
  let sharp
  let pngToIco
  try {
    sharp = require('sharp')
    pngToIco = require('png-to-ico')
  } catch (error) {
    console.warn('Store icon tools missing. Run npm install to add sharp and png-to-ico.')
    return
  }

  const root = process.cwd()
  const srcIcon = path.join(root, 'public', 'icon.png')
  if (!fs.existsSync(srcIcon)) {
    console.warn('Source icon not found:', srcIcon)
    return
  }

  const buildDir = path.join(root, 'build')
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }
  const appxDir = path.join(buildDir, 'appx')
  if (!fs.existsSync(appxDir)) {
    fs.mkdirSync(appxDir, { recursive: true })
  }

  const writePng = (filePath, buffer) => {
    fs.writeFileSync(filePath, buffer)
    console.log(`Generated: ${filePath}`)
  }

  const renderIconBuffer = async (width, height) => {
    return sharp(srcIcon)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer()
  }

  const sizes = [16, 32, 48, 64, 256]
  const buffers = []

  for (const size of sizes) {
    const targetPath = path.join(buildDir, `icon-${size}.png`)
    const buffer = await renderIconBuffer(size, size)
    writePng(targetPath, buffer)
    buffers.push(buffer)
  }

  const icoPath = path.join(buildDir, 'icon.ico')
  const icoBuffer = await pngToIco(buffers)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`Generated: ${icoPath}`)

  const appxAssets = [
    { name: 'Square44x44Logo.png', width: 44, height: 44 },
    { name: 'Square150x150Logo.png', width: 150, height: 150 },
    { name: 'Wide310x150Logo.png', width: 310, height: 150 },
    { name: 'Square310x310Logo.png', width: 310, height: 310 },
  ]

  for (const asset of appxAssets) {
    const targetPath = path.join(appxDir, asset.name)
    const buffer = await renderIconBuffer(asset.width, asset.height)
    writePng(targetPath, buffer)
  }

  // Windows taskbar/search surfaces prefer exact target-size variants and
  // use altform-unplated assets to avoid the backplate/background.
  const appListTargetSizes = [16, 20, 24, 30, 32, 36, 40, 44, 48, 60, 64, 72, 80, 96, 256]
  for (const size of appListTargetSizes) {
    const baseBuffer = await renderIconBuffer(size, size)
    const baseName = `Square44x44Logo.targetsize-${size}`
    writePng(path.join(appxDir, `${baseName}.png`), baseBuffer)
    writePng(path.join(appxDir, `${baseName}_altform-unplated.png`), baseBuffer)
    writePng(path.join(appxDir, `${baseName}_altform-lightunplated.png`), baseBuffer)
  }

  // Keep StoreLogo transparent to avoid forced background color in Store/taskbar tiles.
  const storeLogoPath = path.join(appxDir, 'StoreLogo.png')
  const storeBuffer = await renderIconBuffer(50, 50)
  writePng(storeLogoPath, storeBuffer)
}

ensureStoreIcons().catch((error) => {
  console.warn('Failed to prepare store icons:', error?.message || error)
})
