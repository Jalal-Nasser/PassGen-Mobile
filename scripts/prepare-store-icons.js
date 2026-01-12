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

  const sizes = [256, 512]
  const buffers = []

  for (const size of sizes) {
    const targetPath = path.join(buildDir, `icon-${size}.png`)
    const buffer = await sharp(srcIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer()
    fs.writeFileSync(targetPath, buffer)
    console.log(`Generated: ${targetPath}`)
    buffers.push(buffer)
  }

  const icoPath = path.join(buildDir, 'icon.ico')
  const icoBuffer = await pngToIco(buffers)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`Generated: ${icoPath}`)
}

ensureStoreIcons().catch((error) => {
  console.warn('Failed to prepare store icons:', error?.message || error)
})
