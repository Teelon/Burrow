import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { bin, root } from './lib.mjs'

/**
 * Dev server: Vite (SPA + HMR, proxies /api) and Wrangler dev (Worker + local D1).
 * Open http://localhost:5173
 */
const devVars = path.join(root, '.dev.vars')
if (!fs.existsSync(devVars)) {
  fs.copyFileSync(path.join(root, '.dev.vars.example'), devVars)
  console.log('created .dev.vars from .dev.vars.example')
}

const assetsDir = path.join(root, 'dist', 'web')
if (!fs.existsSync(path.join(assetsDir, 'index.html'))) {
  fs.mkdirSync(assetsDir, { recursive: true })
  fs.writeFileSync(
    path.join(assetsDir, 'index.html'),
    '<!doctype html><html><body><p>Run <code>pnpm build</code> for the production bundle; use http://localhost:5173 in dev.</p></body></html>',
  )
}

const children = []
function launch(label, cmd, args) {
  // Stdin is ignored so child processes (Wrangler/Vite) don't fight over the console
  // or put Windows terminal into raw modes that trap keystrokes / block Ctrl+C.
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
  })
  child.on('exit', (code) => {
    console.log(`${label} exited (${code})`)
    shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

function killTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {}
  } else {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {}
  }
}

let shuttingDown = false
function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\nStopping dev servers...')
  for (const c of children) {
    killTree(c.pid)
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

// Allow pressing Ctrl+C or 'q' in terminal to stop cleanly
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (key) => {
    if (key === '\u0003' || key.toLowerCase() === 'q') {
      shutdown(0)
    }
  })
}

console.log('starting wrangler dev on http://127.0.0.1:8787 and vite on http://localhost:5173')
console.log('press Ctrl+C or "q" at any time to stop\n')
launch('wrangler', process.execPath, [
  bin('wrangler'),
  'dev',
  '--port',
  '8787',
  '--show-interactive-dev-session=false',
])
launch('vite', process.execPath, [bin('vite'), '--port', '5173', '--strictPort', '--clearScreen', 'false'])

