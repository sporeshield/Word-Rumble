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
- [x] **Phase 3 — Art pack** ✅ 2026-10-25: 26 Codex-generated images (1.5 MB) in `resources/art/`, app icon in `build/icon.png` + `build/icon.ico`.
  - `resources/art/MANIFEST.md` lists every file with size and usage (title-bg, bag/bag-shake, rack-holder + rack-holder-tint for CSS colouring, tile-face/back, board-frame, halftone-1..3, burst-1..4, penalty-wheel + pointer, hint-bulb, take-laptop, trophy, notebook paper/spiral, `notebook-doodles/` crown/star/stick-trophy). No text baked in.
  - Tile face is a blank cream/gold tile; board-frame has an open centre; the wheel has 8 unlabeled slices (labels drawn in CSS/SVG in Phase 11).
  - Plan updated: **hidden scores** rule (only the current player sees their own score until Game over) added to PLAN.md feature 5 and CLAUDE.md — Phases 8–12 must honour it.
- [x] **Phase 4 — Engine core** ✅ 2026-10-25: types, board layout, tile set, bag, placement rules, scoring + 25 vitest tests; Codex review done and its 4 findings fixed.
  - Files in `src/renderer/engine/`: `types.ts`, `tiles.ts` (108 tiles, `createTileSet`), `board.ts` (`PREMIUM_LAYOUT`, `createBoard`), `bag.ts` (`shuffle`/`randomInt` crypto, `createBag`, `drawTiles`, `returnTiles`), `rules.ts` (`validatePlacement` → words or error code), `scoring.ts` (`scorePlay`, `applyPlacements`), `index.ts` barrel, `engine.test.ts`.
  - Model: `Tile{id,letter,points}` with letter `'?'` for blanks; a `Placement` carries the effective A–Z `letter` (blank letter chosen). Validation also rejects tile/letter mismatch, reused tile ids, fractional squares. Dictionary check is NOT here (Phase 7 word service / Phase 10).
  - `PlayScore.premiumsHit` lists each newly covered premium square once (START/DW/TW/DL/TL) — Phase 11 bursts use it.
  - Not yet built (Phase 5): end-game adjustments, turn state, exchange rules (`EXCHANGE_MIN_BAG` const exists).
- [x] **Phase 5 — Game reducer** ✅ 2026-10-25: pure reducer + burst decks, 53 tests total; Codex review done and its 6 findings fixed.
  - Files: `engine/game.ts` (`createGame`, `reduce(state, action) → {ok,state}|{ok:false,error}`, `drawForFirstTurn`, `scorelessLimit`), `engine/penalties.ts` (`spinPenalty`, `penaltySlices(solo)`, `rollHintCost`), `fx/bursts.ts` (pools ~150 words, `createBurstDecks`/`drawBurst`, no repeats, borrows from lower tier), `engine/game.test.ts`.
  - Actions: play (with `madeUp`, `penalty`, `vote`), exchange, pass, timeout, concede, finish (solo), hint-offer/accept/decline. UI rolls the random bits (wheel, hint cost) and passes them in. State is JSON-safe (autosave); `state.lastBurst` = burst of the latest action; `state.firstDraw` = rounds for the reveal; `state.result` has adjustments/winner at game over.
  - Decisions: scoreless limit 6 (two players, skipped turns count) / solo 3 consecutive pass+timeout only; solo `skip` slice is a no-op; conceding solo = reason `finished` with `conceded` flag; dictionary check stays in the UI/word service; Gift gives the opponent the play's points and the mover 0.
- [x] **Phase 6 — Move generator** ✅ 2026-10-25: trie + anchor search + worker, 64 tests total; Codex review found no move-generation bugs (its brute-force check matched on 120 states) and 3 small client/worker issues, fixed.
  - Files in `src/renderer/ai/`: `trie.ts` (compact `Trie`, `insert` for custom words), `movegen.ts` (`generateMoves(board, rack, trie) → Move[]` best first, `bestMove`, `Move = {placements, words, score}`), `ai.worker.ts` (messages `load` / `add-words` / `moves`), `client.ts` (`new MoveFinder(words)`, `.find(board, rack, limit?)`, `.addWords`, `.terminate`), tests `movegen.test.ts`, `realwords.test.ts` (real ENABLE list).
  - Moves are validated and scored by the engine itself, so they match what the game accepts. Dictionary = whatever words the Trie was given (Phase 7 word service must supply ENABLE + extras + custom words).
  - Not yet done: Easy/Medium/Hard move picking (Phase 13); worker `limit` trims after full generation (a full-rack empty-board search can take ~0.6 s; fine in a worker). Hints UI is Phase 11.
- [ ] **Phase 7 — Main process**: sql.js DB + migrations, word service + custom words, settings, preload API, desktop shortcut create/repair.
- [ ] **Phase 8 — Board, tiles, racks** *(Codex builds)*: Board / Square / Tile / Rack (face-down + flip, count-only when hidden) / DragLayer / GhostTiles + cartoon theme using Phase 3 art.
- [ ] **Phase 9 — Opening screens**: Title, Setup, Shuffle the bag + first draw, face-down deal, "take the laptop / Let's go!" handoff.
- [ ] **Phase 10 — Play loop**: drag/click placing, recall, rack shuffle, exchange, pass, blank picker, word-check dialog, timer, pause, admit defeat.
- [ ] **Phase 11 — Fun layer** *(Codex visuals)*: penalty wheel, hint dialog + bouncing ghost tiles, comic bursts (no repeats) + confetti, every sound wired.
- [ ] **Phase 12 — Scores**: game over, notebook high scores (all tabs, Hall of Shame), autosave / Continue. *Codex notebook look.*
- [ ] **Phase 13 — Computer opponent**: Easy / Medium / Hard.
- [ ] **Phase 14 — Ship it**: package the portable `Word Rumble/` folder, desktop-shortcut offer, Playwright e2e, offline + move checks, polish. *Codex final review.*
