# Word Rumble (folder: `Scrabble`)

Our own cartoon crossword-tile word game in the Scrabble style for Shane & Dawn: Electron + electron-vite + React + TypeScript, pnpm, sql.js. The game itself is **Word Rumble** — never use Scrabble's name, branding, board layout or tile values in the game; use ours from `docs/PLAN.md`.

## Every session = one phase
1. Read `docs/PROGRESS.md` first. Work on the **first phase not marked ✅** — that phase only.
2. Open only the sections of `docs/PLAN.md` that phase needs (Phases table + the sections it touches). Don't re-read the whole plan.
3. **Codex first**: give all image creation, visual components, CSS and animation to Codex through the Codex plugin (`codex:rescue` skill / `codex:codex-rescue` agent). Claude writes a tight brief (files, props, palette, art paths), reviews the result, integrates and tests. Ask Codex for a review pass on phases 4, 5, 6, 14, 20, 24 and 26.
4. Before finishing: run `pnpm test` and `pnpm typecheck` once they exist, and fix failures.
5. Update `docs/PROGRESS.md`: tick the phase ✅ and add 2–5 hand-off notes (files created, decisions, anything left over).
6. Commit locally (`git add -A` + `git commit`; no remote, never push).
7. Stop and tell the user: **"Phase N done — type `/clear`, then `/next-phase`."**

## Rules that always apply
- **Portable**: the game must work after the folder is moved (e.g. to an external drive). No absolute paths in code, DB or settings; resolve folders via `src/main/paths.ts`; Electron `userData` points inside the game folder; nothing written to AppData.
- **Offline**: all assets (word list, fonts, sounds, art) live in the folder. Only "Look it up" opens the internet.
- **Hidden racks**: a face-down rack gets only a tile count — letters never reach the DOM until its owner presses "Let's go!".
- **Hidden scores**: during play only the current player sees their **own** score; the opponent's score (and any lead/behind hint) is never shown anywhere until Game over. Keep opponent totals out of the DOM, like hidden racks. See `docs/PLAN.md` feature 5.
- **Sound on every action** through `src/renderer/audio/sfx.ts` (named sounds; `sounds/custom/` overrides).
- Game logic stays pure in `src/renderer/engine/` (no React/DOM) and is unit-tested with vitest.
- Defaults: player names **Shane** and **Dawn**; Shane teal, Dawn violet.
- Dev runs use `dev-data/`; real scores live in `Word Rumble/data/` — never delete or overwrite them.
