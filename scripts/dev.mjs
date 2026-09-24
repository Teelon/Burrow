import { spawn } from 'node:child_process'
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
  const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: false })
  child.on('exit', (code) => {
    console.log(`${label} exited (${code})`)
    shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

let shuttingDown = false
function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    if (!c.killed) c.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('starting wrangler dev on http://127.0.0.1:8787 and vite on http://localhost:5173')
launch('wrangler', process.execPath, [bin('wrangler'), 'dev', '--port', '8787'])
launch('vite', process.execPath, [bin('vite'), '--port', '5173', '--strictPort'])
