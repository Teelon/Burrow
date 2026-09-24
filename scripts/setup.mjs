#!/usr/bin/env node
/**
 * First-time provision + deploy. Idempotent. Run with `pnpm setup`.
 *
 * Flags:
 *   --dry-run              print every command without running it
 *   --domain <domain>      attach a custom domain (must be on Cloudflare DNS in this account)
 *   --name <worker-name>   deploy under a different worker name
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { argValue, bin, hasFlag, root, run, smoke, step, parseFirstJson } from './lib.mjs'

const dryRun = hasFlag('--dry-run')
const domain = argValue('--domain')
const workerName = argValue('--name')
const WRANGLER_ARGS = workerName ? ['--name', workerName] : []

async function main() {
  step('Preflight')
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (nodeMajor < 20) {
    console.error(`Node 20+ required, found ${process.version}`)
    process.exit(1)
  }
  console.log(`node ${process.version}, dry-run: ${dryRun}`)
  run('pnpm', ['install'], { dryRun })

  step('Cloudflare login')
  const whoami = run(bin('wrangler'), ['whoami', '--json'], {
    dryRun,
    capture: true,
    allowFail: true,
    quiet: true,
  })
  if (!dryRun && whoami.status !== 0) {
    console.log('not logged in — running `wrangler login` (opens your browser)')
    run(bin('wrangler'), ['login'], { dryRun })
  } else {
    console.log('wrangler: logged in')
  }

  // Multiple accounts and no explicit choice? Ask which one to use.
  if (!process.env.CLOUDFLARE_ACCOUNT_ID && !dryRun) {
    const info = parseFirstJson(whoami.stdout ?? '')
    const accounts = collectAccounts(info)
    if (accounts.length > 1) {
      console.log('Multiple Cloudflare accounts found:')
      accounts.forEach((a, i) => console.log(`  [${i}] ${a.name ?? '(no name)'}  ${a.id}`))
      const rl = await readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await rl.question('Which account id should be used: ')
      rl.close()
      const chosen = accounts.find((a) => a.id === answer.trim()) ?? accounts[Number(answer)]
      if (!chosen) {
        console.error('no matching account selected')
        process.exit(1)
      }
      process.env.CLOUDFLARE_ACCOUNT_ID = chosen.id
      console.log(`using account ${chosen.id}`)
    }
  }

  step('Typecheck + build')
  run(process.execPath, [bin('typescript', 'tsc'), '-b'], { dryRun })
  run(process.execPath, [bin('vite'), 'build'], { dryRun })

  step('Deploy (auto-provisions D1 + R2 on first deploy, then writes ids into wrangler.jsonc)')
  const deployArgs = ['deploy', ...WRANGLER_ARGS]
  if (domain) deployArgs.push('--domains', domain)
  const deploy = run(bin('wrangler'), deployArgs, { dryRun, capture: true })
  const url = domain
    ? `https://${domain}`
    : (deploy.stdout.match(/https:\/\/[^\s]*workers\.dev[^\s]*/)?.[0] ?? null)
  if (!dryRun && !url) {
    console.error('could not determine the deployed URL from wrangler output')
    process.exit(1)
  }
  const origin = url ?? 'https://<deployed-url>'
  console.log(`deployed: ${origin}`)

  step('Ensure D1 database id is written to wrangler.jsonc')
  ensureDatabaseId(dryRun)

  step('Apply migrations to remote D1')
  run(bin('wrangler'), ['d1', 'migrations', 'apply', 'burrow', '--remote'], {
    dryRun,
    // skip the interactive confirmation; migrations are expand-only (rule 13)
    env: { CI: '1' },
  })

  step('Upload secrets (skip existing)')
  const originForAuth = domain ? `https://${domain}` : origin
  const generated = {}
  if (!dryRun) {
    const existing = new Set(
      (parseFirstJson(
        run(bin('wrangler'), ['secret', 'list', '--format', 'json'], {
          capture: true,
          allowFail: true,
          quiet: true,
        }).stdout ?? '[]',
      ) ?? []).map((s) => s.name),
    )
    if (!existing.has('BETTER_AUTH_SECRET')) {
      generated.BETTER_AUTH_SECRET = crypto.randomBytes(32).toString('base64url')
    }
    if (!existing.has('BOOTSTRAP_TOKEN')) {
      generated.BOOTSTRAP_TOKEN = crypto.randomBytes(16).toString('hex')
    }
    if (!existing.has('BETTER_AUTH_URL')) {
      generated.BETTER_AUTH_URL = originForAuth
    }
    if (Object.keys(generated).length > 0) {
      const tmp = path.join(root, '.secrets.tmp.json')
      fs.writeFileSync(tmp, JSON.stringify(generated, null, 2))
      try {
        run(bin('wrangler'), ['secret', 'bulk', tmp], { dryRun })
      } finally {
        fs.rmSync(tmp, { force: true })
      }
    } else {
      console.log('  all secrets already set — nothing to do')
    }
  } else {
    run(bin('wrangler'), ['secret', 'bulk', '.secrets.tmp.json'], { dryRun })
  }

  // Keep local dev usable with the same bootstrap token.
  const devVars = path.join(root, '.dev.vars')
  if (!dryRun && !fs.existsSync(devVars)) {
    const devSecret = crypto.randomBytes(32).toString('base64url')
    fs.writeFileSync(
      devVars,
      [
        `BETTER_AUTH_SECRET=${devSecret}`,
        'BETTER_AUTH_URL=http://127.0.0.1:8787',
        `BOOTSTRAP_TOKEN=${generated.BOOTSTRAP_TOKEN ?? crypto.randomBytes(16).toString('hex')}`,
        '',
      ].join('\n'),
    )
    console.log('wrote .dev.vars for local development (git-ignored)')
  } else if (dryRun) {
    console.log('  [dry-run] would write .dev.vars for local development if missing')
  }

  step('Smoke test')
  if (dryRun) {
    console.log(`  [dry-run] GET ${origin}/api/health`)
  } else {
    const ok = await smoke(origin)
    if (!ok) process.exit(1)
  }

  console.log('\nSetup complete.')
  console.log(`  URL: ${origin}`)
  if (generated.BOOTSTRAP_TOKEN) {
    console.log('\n  One-time BOOTSTRAP_TOKEN (shown once, also written to .dev.vars):')
    console.log(`    ${generated.BOOTSTRAP_TOKEN}`)
    console.log('\n  Open the URL and create the owner account with this token.')
  } else {
    console.log('\n  BOOTSTRAP_TOKEN was already set previously — see .dev.vars or your secret store.')
  }
}

function ensureDatabaseId(dryRun) {
  const configPath = path.join(root, 'wrangler.jsonc')
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const d1 = cfg.d1_databases?.[0]
  if (!d1) {
    console.error('wrangler.jsonc has no d1_databases entry')
    process.exit(1)
  }
  if (d1.database_id) {
    console.log('  database_id already present')
    return
  }
  // Fallback path (non-interactive deploys skip config write-back): create explicitly.
  const out = run(bin('wrangler'), ['d1', 'create', d1.database_name], {
    dryRun,
    capture: true,
    allowFail: true,
    quiet: true,
  })
  const id = /database_id[:\s]+([0-9a-f-]{36})/i.exec(out.stdout)?.[1]
  if (dryRun) {
    console.log(`  [dry-run] would write database_id into wrangler.jsonc (parsed: ${id ?? 'pending'})`)
    return
  }
  if (!id) {
    // Create may have failed because it already exists — look it up by name.
    const list = run(bin('wrangler'), ['d1', 'list', '--json'], { capture: true, quiet: true })
    const dbs = parseFirstJson(list.stdout) ?? []
    const found = dbs.find((d) => d.database_name === d1.database_name)
    if (!found) {
      console.error('could not create or locate the D1 database')
      process.exit(1)
    }
    d1.database_id = found.uuid ?? found.database_id
  } else {
    d1.database_id = id
  }
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n')
  console.log(`  wrote database_id ${d1.database_id} into wrangler.jsonc`)
}

function collectAccounts(node) {
  const found = new Map()
  const visit = (n) => {
    if (!n) return
    if (Array.isArray(n)) return n.forEach(visit)
    if (typeof n === 'object') {
      if (typeof n.id === 'string' && /^[0-9a-f]{32}$/.test(n.id)) {
        found.set(n.id, { id: n.id, name: n.name })
      }
      for (const v of Object.values(n)) visit(v)
    }
  }
  visit(node)
  return [...found.values()]
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
