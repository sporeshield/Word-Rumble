# Word Rumble — build progress

**How to continue:** open a terminal, `cd C:\NextJS_Projects\Scrabble`, run `claude`, then type `/next-phase`.
After each phase: `/clear`, then `/next-phase`.

- [x] **Phase 0 — Hand-off setup** ✅ 2026-10-25
  - Created `CLAUDE.md`, `docs/PLAN.md` (full plan + Appendix A board layout + Appendix B research notes), this file, `.claude/settings.json` (Sonnet 5.5, medium effort), `/next-phase` command, `.gitignore`, local git repo.
  - No game code yet.
- [x] **Phase 1 — Scaffold** ✅ 2026-10-25: Electron + electron-vite + React + TS, `.npmrc` `node-linker=hoisted`, pnpm build allow-list (electron, esbuild), `src/main/paths.ts` (portable folders, `userData` inside game folder), fullscreen blank window runs with `pnpm dev`; `pnpm typecheck` + `pnpm test` scripts.
  - Created `package.json`, `.npmrc`, `pnpm-workspace.yaml` (pnpm 11 build allow-list: electron, esbuild — the `pnpm` field in package.json is ignored now), `electron.vite.config.ts`, split tsconfigs (`tsconfig.node.json` / `tsconfig.web.json`), `vitest.config.ts`.
  - `src/main/paths.ts` (packaged → next to exe; dev → `dev-data/`; sets `userData`/`sessionData` inside it), `src/main/index.ts` (fullscreen, no menu, F11), empty preload, renderer stub (`App.tsx`). Esc = pause is left for Phase 10.
  - Versions: Electron 45, electron-vite 6, vite 8, TypeScript 7, vitest 5, React 19. `pnpm dev`, `build`, `typecheck`, `test` all work. If `node_modules/electron/dist` is ever missing, run `node node_modules/electron/install.js`.
  - Vitest picks up `src/**/*.test.ts`; renderer CSP is set in `src/renderer/index.html` (extend if fonts/workers need it).
- [x] **Phase 2 — Assets** ✅ 2026-10-25: word list, fonts and sounds are in `resources/` (1.7 MB total).
  - Created `scripts/fetch-assets.mjs`, `scripts/render-sounds.mjs`, `scripts/sound-map.mjs` (sound-name map); `package.json` scripts `assets:fetch` / `assets:sounds`; `.cache/` git-ignored. Both scripts are idempotent.
  - `resources/words/enable.txt.gz` (172,823 words) + `extras.txt` (14 newer official 2-letter words, e.g. qi, za, ok, ew); `resources/fonts/` Bangers + Fredoka (variable TTF) with OFL texts.
  - `resources/sounds/`: 37 Kenney CC0 files + 9 own synthesized .wav (word-invalid, burst-boom-1..3, rumble-fanfare, buzzer, defeat-trombone, game-over-fanfare, high-score-ding); credits in `CREDITS.md`. Phase 8+ `sfx.ts` should use the names in `scripts/sound-map.mjs`.
  - Note: Codex hit a sandbox `spawn EPERM` running vitest; it works normally here.
- [ ] **Phase 3 — Art pack** *(Codex image generation)*: title background, cloth bag (+ shake pose), wooden rack holder, tile face/back, board frame, halftone backgrounds, burst shapes, penalty wheel, hint lightbulb, "take the laptop" art, trophy, notebook paper/spiral/doodles, app icon (PNG → ICO). No text baked into images.
- [ ] **Phase 4 — Engine core**: types, board layout (Appendix A), tile set, bag (crypto shuffle), placement rules, scoring + vitest. *Codex review.*
- [ ] **Phase 5 — Game reducer**: turns, first-turn draw, exchange/pass, end conditions, admit defeat, timeout, penalty-wheel outcomes, hint cost lock, burst decks + vitest. *Codex review.*
- [ ] **Phase 6 — Move generator**: trie + anchor search for hints/computer, Web Worker + vitest. *Codex review.*
- [ ] **Phase 7 — Main process**: sql.js DB + migrations, word service + custom words, settings, preload API, desktop shortcut create/repair.
- [ ] **Phase 8 — Board, tiles, racks** *(Codex builds)*: Board / Square / Tile / Rack (face-down + flip, count-only when hidden) / DragLayer / GhostTiles + cartoon theme using Phase 3 art.
- [ ] **Phase 9 — Opening screens**: Title, Setup, Shuffle the bag + first draw, face-down deal, "take the laptop / Let's go!" handoff.
- [ ] **Phase 10 — Play loop**: drag/click placing, recall, rack shuffle, exchange, pass, blank picker, word-check dialog, timer, pause, admit defeat.
- [ ] **Phase 11 — Fun layer** *(Codex visuals)*: penalty wheel, hint dialog + bouncing ghost tiles, comic bursts (no repeats) + confetti, every sound wired.
- [ ] **Phase 12 — Scores**: game over, notebook high scores (all tabs, Hall of Shame), autosave / Continue. *Codex notebook look.*
- [ ] **Phase 13 — Computer opponent**: Easy / Medium / Hard.
- [ ] **Phase 14 — Ship it**: package the portable `Word Rumble/` folder, desktop-shortcut offer, Playwright e2e, offline + move checks, polish. *Codex final review.*
