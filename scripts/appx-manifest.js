const fs = require('fs')

function setAttr(tag, name, value) {
  const attrRe = new RegExp(`\\s${name}="[^"]*"`, 'i')
  if (attrRe.test(tag)) {
    return tag.replace(attrRe, ` ${name}="${value}"`)
  }
  return tag.replace(/\s*(\/?>)$/, ` ${name}="${value}"$1`)
}

function removeAttr(tag, name) {
  const attrRe = new RegExp(`\\s${name}="[^"]*"`, 'ig')
  return tag.replace(attrRe, '')
}

module.exports = async function appxManifestCreated(manifestPath) {
  const xml = await fs.promises.readFile(manifestPath, 'utf8')
  let updated = xml

  const visualRe = /<uap:VisualElements\b[^>]*>/i
  const visualMatch = updated.match(visualRe)
  if (visualMatch) {
    let visualTag = visualMatch[0]
    visualTag = setAttr(visualTag, 'Square44x44Logo', 'assets\\Square44x44Logo.png')
    visualTag = setAttr(visualTag, 'Square150x150Logo', 'assets\\Square150x150Logo.png')
    updated = updated.replace(visualRe, visualTag)
  }

  const defaultTileOpenRe = /<uap:DefaultTile\b[^>]*>/i
  const defaultTileMatch = updated.match(defaultTileOpenRe)
  if (defaultTileMatch) {
    let defaultTileTag = defaultTileMatch[0]
    defaultTileTag = setAttr(defaultTileTag, 'Wide310x150Logo', 'assets\\Wide310x150Logo.png')
    defaultTileTag = setAttr(defaultTileTag, 'Square310x310Logo', 'assets\\Square310x310Logo.png')
    defaultTileTag = removeAttr(defaultTileTag, 'Square71x71Logo')
    updated = updated.replace(defaultTileOpenRe, defaultTileTag)
  } else {
    updated = updated.replace(
      /<\/uap:VisualElements>/i,
      `  <uap:DefaultTile Wide310x150Logo="assets\\Wide310x150Logo.png" Square310x310Logo="assets\\Square310x310Logo.png" />\n</uap:VisualElements>`
    )
  }

  await fs.promises.writeFile(manifestPath, updated)
}
