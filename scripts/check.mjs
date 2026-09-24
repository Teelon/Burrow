import { bin, run } from './lib.mjs'

/** Local replacement for CI: typecheck, lint, API tests. Aborts on first failure. */
console.log('check: typecheck')
run(bin('typescript', 'tsc'), ['-b'])

console.log('check: lint')
run(bin('eslint'), ['.'])

console.log('check: tests')
run(bin('vitest'), ['run'])

console.log('check: OK')
