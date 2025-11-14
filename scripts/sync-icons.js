const fs = require('fs');
const path = require('path');

function copy(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`Synced: ${src} -> ${dest}`);
  } catch (e) {
    console.warn(`Warn: failed to copy ${src} -> ${dest}:`, e.message);
  }
}

const root = process.cwd();
const publicIcon = path.join(root, 'public', 'icon.png');
const buildDir = path.join(root, 'build');
const buildIcon = path.join(buildDir, 'icon.png');

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
if (fs.existsSync(publicIcon)) copy(publicIcon, buildIcon);

// Optional: ensure dist also has fresh icons when building standalone vite
const distDir = path.join(root, 'dist');
const distIcon = path.join(distDir, 'icon.png');
if (fs.existsSync(distDir) && fs.existsSync(publicIcon)) copy(publicIcon, distIcon);
