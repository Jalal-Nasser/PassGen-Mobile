const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function safeExec(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

const envCommit =
  process.env.PASSGEN_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.GIT_COMMIT ||
  ''

const envDate =
  process.env.PASSGEN_BUILD_DATE ||
  process.env.VERCEL_GIT_COMMIT_DATE ||
  process.env.BUILD_DATE ||
  ''

const commitFull = envCommit || safeExec('git rev-parse HEAD')
const commit = commitFull ? commitFull.slice(0, 12) : 'unknown'
const commitDate = envDate || safeExec('git log -1 --format=%cI')
const buildTime = new Date().toISOString()

const info = {
  commit,
  commitFull: commitFull || 'unknown',
  date: commitDate || buildTime,
  buildTime
}

const target = path.join(process.cwd(), 'resources', 'build-info.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, JSON.stringify(info, null, 2))
console.log(`[BUILD] Wrote ${target}`)
