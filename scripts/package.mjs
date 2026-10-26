// Builds the portable game folder `Word Rumble/` next to this project.
// Re-running replaces the app files only: `data/` (scores, autosave) and `sounds/custom/` are never touched.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'Word Rumble')
const built = join(root, '.cache', 'pack', 'win-unpacked')
const KEEP = new Set(['data'])

const run = (args) => {
  const r = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(['exec', 'electron-vite', 'build'])
rmSync(join(root, '.cache', 'pack'), { recursive: true, force: true })
run(['exec', 'electron-builder', '--dir', '--win'])
if (!existsSync(built)) throw new Error(`Expected build output at ${built}`)

mkdirSync(target, { recursive: true })
for (const name of readdirSync(target)) {
  if (KEEP.has(name)) continue
  if (name === 'sounds') {
    // keep sounds/custom, replace the rest
    for (const sub of readdirSync(join(target, 'sounds'))) if (sub !== 'custom') rmSync(join(target, 'sounds', sub), { recursive: true, force: true })
    continue
  }
  rmSync(join(target, name), { recursive: true, force: true })
}
cpSync(built, target, { recursive: true })
mkdirSync(join(target, 'data'), { recursive: true })
mkdirSync(join(target, 'sounds', 'custom'), { recursive: true })
console.log(`\nPackaged: ${target}`)
