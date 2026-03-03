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

  const transparentKeyThreshold = 8
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
    fs.writeFileSync(targetPath, buffer)
    console.log(`Generated: ${targetPath}`)
    buffers.push(buffer)
  }

  const icoPath = path.join(buildDir, 'icon.ico')
  const icoBuffer = await pngToIco(buffers)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`Generated: ${icoPath}`)

  // StoreLogo needs a solid purple background for the Microsoft Store listing
  const renderStoreLogoBuffer = async (width, height) => {
    const iconBuffer = await renderIconBuffer(width, height)
    // Padding: icon fills 70% of the tile, centered
    const iconSize = Math.round(width * 0.7)
    const padding = Math.round((width - iconSize) / 2)
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 124, g: 58, b: 237, alpha: 1 } // #7C3AED purple
      }
    })
      .composite([{
        input: await sharp(srcIcon).resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
        top: padding,
        left: padding
      }])
      .png()
      .toBuffer()
  }

  const appxAssets = [
    { name: 'Square44x44Logo.png', width: 44, height: 44 },
    { name: 'Square150x150Logo.png', width: 150, height: 150 },
    { name: 'Wide310x150Logo.png', width: 310, height: 150 },
    { name: 'Square310x310Logo.png', width: 310, height: 310 },
  ]

  for (const asset of appxAssets) {
    const targetPath = path.join(appxDir, asset.name)
    const buffer = await renderIconBuffer(asset.width, asset.height)
    fs.writeFileSync(targetPath, buffer)
    console.log(`Generated: ${targetPath}`)
  }

  // StoreLogo with solid purple background
  const storeLogoPath = path.join(appxDir, 'StoreLogo.png')
  const storeBuffer = await renderStoreLogoBuffer(50, 50)
  fs.writeFileSync(storeLogoPath, storeBuffer)
  console.log(`Generated: ${storeLogoPath} (with purple background)`)
}

ensureStoreIcons().catch((error) => {
  console.warn('Failed to prepare store icons:', error?.message || error)
})
