import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src', 'web');

/**
 * Basalt design-system regression guard.
 * Every pattern below must have ZERO matches in src/web (calibrated 2026-09-24).
 */
const patterns = [
  /rounded-/,
  /shadow-(xs|sm|ml|md|lg|xl|2xl)/,
  /bg-neutral-/,
  /border-neutral-/,
  /text-neutral-/,
  /dark:/,
  /TODO\(ui\)/,
  /once available/,
];

const exts = new Set(['.tsx', '.css']);

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (exts.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

let violations = 0;
for (const file of walk(dir)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const re of patterns) {
      if (re.test(line)) {
        console.error(
          `${path.relative(root, file)}:${i + 1}: forbidden ${re.source}: ${line.trim()}`,
        );
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`check: basalt FAILED (${violations} violation(s))`);
  process.exit(1);
}
console.log('check: basalt OK');
