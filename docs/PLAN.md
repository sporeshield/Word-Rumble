# Word Rumble — a cartoon crossword tile word game (desktop, full screen)

## Context
Shane & Dawn want a word-building tile game for this laptop: solo or two players, full screen, bright cartoon look, sound on everything, comic-book "KABLOW!" bursts on bonus squares, a hidden-rack "pass the laptop" flow, speed-timer option, hints and made-up words (penalties optional), an Admit defeat button, and a persistent notebook-style high-score table for bragging rights. Built as **our own game in the Scrabble style** — real researched rules, but an original name (**Word Rumble**), board layout, tile set and look. Project folder: `C:\NextJS_Projects\Scrabble`.

Decisions made with the user: Electron desktop app; solo = high-score run **and** vs computer; local word list (ENABLE, public domain, ~0.44 MB gzipped) + Merriam-Webster Scrabble page as an online "second opinion"; Codex builds the board, tiles and racks.

## Stack
- **Electron + electron-vite + React + TypeScript** (pnpm 11, Node 24 — matches user's stack). Allow `electron`/`esbuild` build scripts in pnpm config.
- **sql.js** (SQLite in WASM — no native build) in the main process, persisted to `Word Rumble/data/word-rumble.sqlite` (atomic temp-file + rename after each write; safe on exFAT external drives).
- Word list `resources/words/enable.txt.gz` + `extras.txt` (newer official 2-letter words ENABLE lacks: QI, ZA, KI, OK, EW, ZE, etc.).
- **Sound files stored in the game folder** (`resources/sounds/`, a few MB) — everything plays fully offline, nothing streamed:
  - Real recorded effects from **Kenney.nl free CC0 packs** (Impact Sounds → wooden tile clacks/thuds, Casino Audio → bag shake & dice, Interface/UI Audio → clicks & pops, Digital/Sci-fi → zaps), downloaded once during the build and trimmed/renamed to our sound names.
  - Our own effects (comic booms, wah-wah, fanfares, sad trombone, anything without a good match) made by rendering synth patches to `.wav` files at build time (`scripts/render-sounds.mjs`), so they're real files too.
  - **Your own sounds**: drop a `.wav`/`.mp3`/`.ogg` with the same name (e.g. `burst-boom.ogg`, `tile-place.wav`) into `Word Rumble/sounds/custom/` and it replaces that effect — record yourselves shouting "KABLOW!" if you like. Missing/broken file → falls back to the built-in one.
- Fonts (OFL, bundled, ~150 KB): **Bangers** for comic bursts/titles, **Fredoka** for tiles/UI; Windows built-in **Ink Free / Segoe Print** for the handwritten notebook.
- Window opens `fullscreen`, menu bar hidden, F11 toggles, Esc = pause.

## Portable folder (can move to an external hard drive)
- `pnpm package` (electron-builder `--dir`) produces a **self-contained playable folder `Scrabble/Word Rumble/`** with `Word Rumble.exe` + the Electron runtime — no Node, pnpm or internet needed to play, works on any Windows PC and any drive letter.
- **Everything the game saves lives inside that folder**: `Word Rumble/data/word-rumble.sqlite` (scores, autosave, settings, custom words), `Word Rumble/data/electron/` (Electron's own cache — `app.setPath('userData', …)` so nothing goes to AppData), and `Word Rumble/sounds/custom/`. All paths are worked out at runtime from the exe's own location; no absolute path is ever stored.
- Re-packaging after code changes only replaces the app files — `data/` and `sounds/custom/` are never touched, so scores survive updates.
- Desktop shortcut: on first launch (and in Settings) the game offers **"Create desktop shortcut"** (`shell.writeShortcutLink` to the current exe, tile icon). If it's launched from a new location (e.g. the external drive) and the existing shortcut points somewhere else, it offers to fix it.
- Dev project is movable too: `.npmrc` `node-linker=hoisted` (no pnpm junctions with absolute paths); dev runs use a separate `Scrabble/dev-data/` so testing never pollutes real scores. After a move, only development needs `pnpm install` — playing doesn't.

## Rules implemented (researched)
- Bag shuffled; **draw for first turn**: each player draws a tile, closest to A starts, blank beats all, ties redraw; tiles returned, bag reshuffled, 7 dealt each.
- First word ≥ 2 letters through the centre star (a 2× word square).
- Tiles in one row/column, contiguous (gaps only filled by existing tiles), must connect to existing tiles; placed tiles never move.
- Score every word formed; letter premiums before word premiums; premiums only count on newly placed tiles; multiple word premiums multiply; blank = 0 pts but still triggers word premiums; letter permanently fixed once played.
- **+50 "RUMBLE!" bonus** for using all 7 tiles in one turn.
- Exchange any number of tiles (0 pts) only when ≥ 7 tiles remain in the bag; Pass (0 pts).
- Game ends when the bag is empty and a player goes out (they gain opponents' remaining tile values, opponents subtract theirs), or after **6 consecutive scoreless turns** (everyone subtracts own rack). Tie-break: higher score before adjustments.
- Solo run ends when bag + rack are empty, after 3 consecutive passes, or "Finish game"; leftover tiles subtracted.
- **Admit defeat** (house rule): available on your turn; confirm dialog → game ends immediately, the other player (or computer) wins regardless of score; scores recorded as they stand and marked "conceded". Solo: ends the run and records the score.

## Original design & cartoon style
- **Whole app is colourful cartoon**: thick black outlines, chunky drop shadows, comic halftone-dot backgrounds, bouncy squash-and-stretch animations, wobbly buttons that pop when clicked.
- **Board 15×15 "starburst" layout** (own pattern, 8-way symmetric): 3× Word ×8 on the edges three in from each corner; 2× Word ×16 + centre star; 3× Letter ×16; 2× Letter ×24 (corners are 2× Letter). Defined once in `engine/board.ts`.
- **Board colours**: tangerine 3W, bubblegum 2W, electric-blue 3L, aqua 2L, mint plain squares, gold star, magenta frame.
- **Own 108-tile set**: A9/1 B2/4 C3/3 D5/2 E13/1 F2/4 G3/3 H4/3 I8/1 J1/9 K1/6 L5/2 M3/3 N6/1 O8/1 P2/4 Q1/10 R6/1 S5/1 T7/1 U4/2 V2/5 W2/4 X1/8 Y2/4 Z1/10 Blank2/0 (count/points). Cream cartoon tiles with bold outlined letters.
- Each player picks a colour (Shane teal, Dawn violet by default) for their rack holder and a little underline on tiles they played.

## Comic-book bursts ("KABLOW!", "BOOM!" …)
- When a play lands on premium squares, a comic burst explodes over the board — jagged starburst or speech bubble, Bangers lettering, halftone fill, shake + pop-in animation, plus a matching sound effect.
- Tiered pools in `src/renderer/fx/bursts.ts` (~150 unique words total):
  - 2× Letter (small): ZING!, POP!, BOINK!, PING!, ZIP!, TWANG! …
  - 3× Letter: ZAP!, KRAK!, THWIP!, SPLAT!, ZOWIE! …
  - 2× Word: BOOM!, KAPOW!, WHAM!, BLAMMO!, THWACK! …
  - 3× Word: KABLOW!, KA-BOOM!, MEGA-WHAM!, KERRRANG!, SHAZAM-BLAM! …
  - Stacked multipliers / RUMBLE bonus / huge scores: special top-tier set (RUMBLE!!!, OUTRAGEOUS!, TOTAL KA-CHAOS!) …
  - Fun extras: made-up word ("FIBBER!", "SAYS WHO?!"), hint bought ("PSST!"), timeout ("TOO SLOW!").
- **No repeats in a game**: each tier is shuffled into a per-game deck at game start; the deck position is kept in game state (and autosave), so a word never shows twice in one game (if a tier runs dry it borrows from the tier below).
- The burst sound is drawn from a set of "boom / zap / pow / whoosh / crash" sound files with randomised pitch so they sound different too.

## Sound on everything (`src/renderer/audio/sfx.ts` — preloads every file from `resources/sounds` + `sounds/custom` overrides, slight random pitch so repeats don't sound robotic)
UI hover tick & click pop · toggles/checkboxes · tile pick-up · tile drag over a square (soft tick) · tile laid on board (wooden clack) · tile removed/returned to rack (reverse swoosh-pop) · recall all · rack shuffle (rattle) · rack reorder · blank letter chosen · exchange (tiles into bag) · pass · bag shake at start · first-turn tile reveal · "See your tiles" flip · rack hide flip · valid word chime · invalid word "wah-wah" · comic burst booms · RUMBLE fanfare · penalty wheel spin + landing · hint dice roll · hint ghost tiles appearing · timer tick (last 10 s) + buzzer · pause/resume · admit defeat sad trombone · game over fanfare · new-high-score ding · notebook page flip & pencil scribble. Volume slider + mute in Settings.

## Features
1. **Title screen** — New Game, Continue Game (autosave), High Scores notebook, Settings (volume/mute, reset scores), Quit.
2. **Setup** — mode (Solo run / Two players / vs Computer Easy·Medium·Hard); names default **Shane** and **Dawn**; colours; Timer **Off** or Speed game (30 s, 1, 2, 3, 5 min or custom 15 s–10 min); **Hints: Off / Free / With penalty**; **Made-up words: Not allowed / Allowed free / Allowed with Penalty Wheel**. Same options for solo and two-player.
3. **Shuffle the bag** — big cartoon cloth bag, press to shake (animation + rattling shuffle sound), then the first-turn tile draw with a reveal and "Dawn goes first!". The tiles are then dealt **face-down** into both holders (flying-tile animation) — no letters are shown anywhere.
4. **Hidden racks / pass the laptop / "Let's go!"** — two labelled holders on screen, always face-down unless their owner reveals them. The first turn of the game and every turn after shows a **"Dawn — take the laptop!"** screen with a big **"Let's go!"** button; nothing about her letters is visible (and her timer hasn't started) until she presses it. Then her holder flips over and her timer starts. On Play/Pass/Exchange/timeout the holder flips face-down again and the "Shane — take the laptop!" screen appears. The same rule applies after Pause → Resume and after Continue Game (two-player): back to the "Let's go!" screen. Computer's rack is never shown; in solo/vs-computer the "Let's go!" screen appears only at the start.
5. **Playing** — drag tiles (or click tile then square) onto the board; Recall, Shuffle rack, Exchange (pick tiles), Pass, Hint, Admit defeat, Play. Blank → letter picker. Live score preview of the pending play. Bag count shown. **Hidden scores (two-player):** once the laptop is handed over, only the player whose turn it is sees **their own** current score; the opponent's score is never shown (no number, bar, lead/behind hint, or "Dawn is ahead" text) until the game is over. Their own score is hidden too on the "take the laptop" screen. Applies to every screen and message: play toasts show only the points scored by the mover's own play for the current player; the opponent's last-play points, penalty-wheel/gift/−10 effects on the opponent, and hint costs are not shown as running totals; the pause menu, the Continue screen and the autosave summary show no scores. Final scores (with itemised adjustments) are revealed together at Game over. Solo and vs Computer show your own score only; the Computer's score is hidden until the end as well.
6. **Word check** — on Play, every formed word is checked against the local list instantly. If a word is missing: dialog lists it with **Take it back** / **Look it up** (opens Merriam-Webster Scrabble page in the browser) / **It's real — add to our word list** (saved to DB) / **Play it as a made-up word** (only if allowed in setup).
7. **Made-up words + Penalty Wheel** (when "with Penalty Wheel") — spinning cartoon wheel (crypto RNG): Half points · Zero points (word stays) · −10 from total · Gift the points to opponent · Skip your next turn · Rack wipe (forced exchange; −10 if bag < 7) · "Convince them!" (opponent votes 👍 keep / 👎 zero) · Lucky escape (rare). Solo swaps opponent slices for −20 / Zero. "Allowed free" = word scores normally with a "FIBBER!" burst.
8. **Hints** — usable any time during your turn. "With penalty": pressing Hint rolls a random cost (5–30 pts, dice animation) shown **before** you choose **Accept (−N)** or **No thanks**; the cost is locked for that turn so declining and re-pressing can't re-roll. "Free": no cost. Accepted → a strong playable move appears as **animated ghost tiles** that bounce onto the board one by one, glowing and wiggling (with sound), until you place your own tiles or dismiss it. Further hints show the next different move (new cost). No moves → "Try exchanging", no charge. Timer keeps running.
9. **Speed timer + Pause** — countdown ring per turn, ticking in the last 10 s, buzzer at 0: placed tiles return and the turn scores 0 (counts toward the 6-scoreless rule). **Pause** (button or Esc) stops the timer and covers board + racks with a pause menu (Resume, Sound, Save & quit to title).
10. **Admit defeat** — button on the game screen → "Are you sure?" cartoon dialog → sad trombone, opponent declared winner, recorded in the notebook.
11. **Game over** — (first time both scores are shown) final scores with end-game adjustments itemised, winner celebration (confetti + burst), "NEW HIGH SCORE!" stamp, then "Write it in the notebook".
12. **High-score notebook** — spiral-bound lined page, red margin line, blue handwritten entries with slight wobble, cartoon doodles (crown on #1, stars, stick-figure trophies), coloured tab dividers: **Top Scores** (filter Two-player / Solo / vs Computer) · **Head to Head** (tally-mark wins, draws, concessions, averages) · **Best Plays** (top single plays, RUMBLE bonuses) · **Recent Games** · **Hall of Shame** (made-up words, penalties, hints bought, defeats admitted).
13. **Autosave / Continue** — game state (incl. burst decks, hint cost lock) saved to DB after every turn; closing mid-game loses nothing.
14. **Computer opponent** — same move generator as hints, run in a Web Worker; Easy picks from lower-scoring moves, Medium mid-range, Hard best score. Never uses made-up words or hints.

## Project layout
```
Scrabble/
  CLAUDE.md                     per-session rules (one phase at a time, Codex for visuals)
  docs/PLAN.md, docs/PROGRESS.md
  .claude/settings.json         Sonnet 5.5, medium effort
  .claude/commands/next-phase.md
  package.json, electron.vite.config.ts, tsconfig*.json, vitest.config.ts
  resources/art/                Codex-generated images (WebP/PNG)
  resources/words/enable.txt.gz, extras.txt   resources/fonts/   resources/sounds/   build/icon.ico
  scripts/render-sounds.mjs     renders our own synth effects to .wav; scripts/fetch-assets.mjs downloads word list, fonts, Kenney packs
  .npmrc                        node-linker=hoisted (movable node_modules)
  Word Rumble/                  ← the portable playable game (built by `pnpm package`)
    Word Rumble.exe, resources/…  (replaced on each package)
    data/                       scores DB + Electron cache (never touched by packaging)
    sounds/custom/              drop-in replacements for any sound (README inside lists the names)
  dev-data/                     (gitignored) data used by `pnpm dev`
  src/main/index.ts             window (fullscreen), IPC registration
  src/main/paths.ts             resolves game/data/sounds folders from the exe location (portable)
  src/main/shortcut.ts          create/repair desktop shortcut
  scripts/package.mjs           electron-builder --dir → sync into `Word Rumble/` keeping data/ & sounds/custom/
  src/main/db.ts                sql.js init, migrations, queries, persistence
  src/main/words.ts             load list into Set + custom words; check/add
  src/preload/index.ts          contextBridge → window.wordRumble {scores, words, savedGame, settings, openLookup}
  src/renderer/engine/          pure TS + vitest: tiles.ts, board.ts, bag.ts, rules.ts, scoring.ts, game.ts (reducer), penalties.ts, hints.ts, types.ts
  src/renderer/ai/              trie.ts, movegen.ts, ai.worker.ts
  src/renderer/components/      (Codex) Board, Square, Tile, Rack (face-down + flip), DragLayer, GhostTiles, theme.css
  src/renderer/fx/              bursts.ts (word pools + no-repeat decks), ComicBurst.tsx, Confetti.tsx
  src/renderer/screens/         Title, Setup, ShuffleBag, Game, Handoff, Pause, PenaltyWheel, HintDialog, BlankPicker, Exchange, WordCheck, AdmitDefeat, GameOver, Notebook
  src/renderer/audio/sfx.ts     sound manager (preload, overrides, volume/mute, pitch variation)
  tests/e2e/smoke.spec.ts       Playwright _electron smoke test
```

DB tables: `players`, `games` (mode, timer, options, ended_reason incl. `conceded`), `game_players` (final score, pre-adjust score, rumbles, hints used, hint points lost, made-up count, conceded), `plays` (words, score, rumble, made_up, penalty), `custom_words`, `saved_game` (JSON), `settings`.

## How we'll work (small sessions, Sonnet 5.5 medium, Codex-heavy)
- Phase 0 was done in the planning session (Opus); all later phases run on Sonnet 5.5 medium from inside the `Scrabble` folder.
- **Phase 0** sets up the hand-off so every later session starts cold and cheap:
  - `Scrabble/.claude/settings.json` → `"model": "claude-sonnet-5-5"`, `"effortLevel": "medium"` (project setting overrides the user-level Opus default; the user settings already map Sonnet 5.5 → medium).
  - `Scrabble/docs/PLAN.md` — this plan, copied into the project.
  - `Scrabble/docs/PROGRESS.md` — phase checklist; each finished phase gets ✅ plus 2–5 lines of hand-off notes (files made, decisions, anything left).
  - `Scrabble/CLAUDE.md` — short project rules: read PROGRESS.md first, open only the PLAN.md sections the current phase needs, do **one phase only**, delegate images/visuals to Codex, run tests, update PROGRESS.md, git commit, then stop and say "Phase N done — type `/clear`, then `/next-phase`".
  - `Scrabble/.claude/commands/next-phase.md` — the `/next-phase` slash command that kicks off the next unchecked phase.
  - `git init` (local only, no remote) so each phase ends with a checkpoint commit.
  - Save memory notes about these working preferences.
- **From Phase 1 on**: start Claude Code **inside `C:\NextJS_Projects\Scrabble`** (`cd C:\NextJS_Projects\Scrabble` then `claude`) so the Sonnet 5.5 medium project default applies; between phases type `/clear` then `/next-phase`.
- **Codex does as much as possible** via the Codex plugin (`codex:rescue` → Codex CLI 0.164, `image_generation` enabled): **all image creation**, all visual components/CSS/animation, and an independent review pass on the bigger code phases. Claude writes the brief, checks the result, wires it in, runs tests.
- Generated art lives in `resources/art/` as optimised WebP/PNG (transparent where needed); no text baked into images — titles/labels are rendered with the bundled fonts so they stay crisp.

## Phases (each sized for one session, then `/clear`)
| # | Phase | Who |
|---|---|---|
| 0 | Hand-off setup (settings, CLAUDE.md, docs, `/next-phase`, git, memory) | Claude (now) |
| 1 | Scaffold Electron + electron-vite + React + TS, `.npmrc` hoisted, pnpm build allow-list, portable `paths.ts`, blank fullscreen window runs | Claude |
| 2 | Assets: `fetch-assets.mjs` (ENABLE → gz, Bangers/Fredoka, Kenney CC0 packs → `resources/sounds` + CREDITS), `render-sounds.mjs` for our own booms/wah-wah/fanfares/trombone | Codex writes scripts, Claude runs & checks |
| 3 | **Art pack** — title background, cartoon cloth bag (+ shake pose), wooden rack holder, tile face/back textures, board frame, halftone comic backgrounds, burst star shapes, penalty wheel, hint lightbulb, "take the laptop" handoff art, trophy, notebook paper/spiral/doodles (crown, stars), app icon (PNG → ICO) | **Codex image generation** |
| 4 | Engine core: types, board layout, tile set, bag (crypto shuffle), placement rules, scoring + vitest | Claude, Codex review |
| 5 | Game reducer: turns, first-turn draw, exchange/pass, end conditions, admit defeat, timeout, penalty wheel outcomes, hint cost lock, burst decks + vitest | Claude, Codex review |
| 6 | Trie + move generator (hints/computer) in a Web Worker + vitest | Claude, Codex review |
| 7 | Main process: sql.js DB + migrations, word service, custom words, settings, preload API, shortcut create/repair | Claude |
| 8 | Board / Square / Tile / Rack (face-down + flip, count-only when hidden) / DragLayer / GhostTiles + cartoon theme, using the Phase 3 art | **Codex** builds, Claude integrates |
| 9 | Screens: Title, Setup, Shuffle-the-bag + first draw, face-down deal, "take the laptop / Let's go!" handoff | Codex visuals, Claude logic |
| 10 | Game screen play loop: drag/click placing, recall, rack shuffle, exchange, pass, blank picker, word-check dialog, timer, pause, admit defeat | Claude, Codex visuals |
| 11 | Fun layer: penalty wheel, hint dialog + bouncing ghost tiles, comic bursts (no repeats) + confetti, every sound wired | **Codex** visuals/animation, Claude wiring |
| 12 | Game over, notebook high scores (all tabs, Hall of Shame), autosave / Continue | **Codex** notebook look, Claude data |
| 13 | Computer opponent (Easy/Medium/Hard) | Claude |
| 14 | Package portable `Word Rumble/` folder, desktop-shortcut offer, Playwright e2e, offline + move checks, polish | Claude, Codex final review |

## Verification
- `pnpm test` — engine unit tests: first-move rules (centre, ≥2 letters), gaps/disconnected/diagonal rejected, cross-word scoring, premiums only on new tiles, stacked word multipliers, blank on word square, +50 bonus, exchange refused when bag < 7, 6-scoreless ending, go-out adjustments + tie-break, timeout = scoreless turn, admit defeat winner, hint cost locked per turn & free mode, penalty outcomes & "allowed free" mode, burst decks never repeat within a game (incl. across autosave restore); move generator only returns legal, listed words.
- `pnpm test:e2e` — Playwright launches Electron: defaults Shane/Dawn → shuffle & draw → dealt tiles face-down, no letters in the DOM until "Let's go!" (also after pause/resume and Continue Game) → play a word, score updates → pause freezes timer → admit defeat → result appears in notebook → relaunch app → score and autosave still present.
- **Move check**: play a game, then copy the `Word Rumble/` folder to a different location/drive (e.g. `D:\` or a USB stick), launch from there — scores and autosave are all present, the shortcut-fix offer appears, and nothing was written to `%AppData%`. Re-run `pnpm package` and confirm scores survive.
- **Offline check**: turn Wi-Fi off, launch from the shortcut, play a full game — all sounds, word checks, hints and scores work (only "Look it up" needs internet). Drop a test file into `sounds/custom/` and confirm it replaces that sound.
- Manual play-through via the desktop shortcut on the laptop screen: full screen, cartoon look, every action makes a sound, bursts on premium squares without repeats, hint ghost-tile animation, accept/decline hint, made-up word wheel, vs Computer on each level.

## Appendix A — Exact board layout (for Phase 4, `engine/board.ts`)
15×15, centre (7,7). For any square take `a = min(|r-7|, |c-7|)`, `b = max(|r-7|, |c-7|)` and look it up (everything else is plain):

| (a,b) | Premium | Squares |
|---|---|---|
| (0,0) | START ★ (acts as 2× Word) | 1 |
| (4,7) | 3× Word | 8 |
| (0,6), (4,4), (2,5) | 2× Word | 4 + 4 + 8 = 16 |
| (0,4), (6,6), (1,6) | 3× Letter | 4 + 4 + 8 = 16 |
| (0,2), (2,2), (7,7), (1,3), (0,7) | 2× Letter | 4 + 4 + 4 + 8 + 4 = 24 |

Corners are 2× Letter. 3× Word squares sit on the edges three squares in from each corner.

## Appendix B — Research notes & sources (gathered during planning, 2026-10-25)
- **Word list**: ENABLE, public domain — `https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt` — 172,823 words, 1,703 KB raw, ~442 KB gzipped. Verified it lacks newer official words QI, ZA (put those and other post-2000 two-letter additions in `extras.txt`); has QAT, JO, ZAX, XU, CWM, AA.
- **Online second opinion**: `https://scrabble.merriam.com/finder/<word>` — opened in the user's browser only (JS-rendered page; don't scrape). Free dictionary APIs tested (dictionaryapi.dev) were flaky (502s/timeouts) and aren't game word lists — not used.
- **Sounds**: Kenney.nl audio packs are CC0 — `https://kenney.nl/assets/impact-sounds`, `/casino-audio`, `/interface-sounds`, `/ui-audio`, `/digital-audio`, `/sci-fi-sounds`. Record credits in `resources/sounds/CREDITS.md`.
- **Tooling on this laptop**: Node 24.19, pnpm 11.20 (needs a build-script allow-list for `electron` + `esbuild`), Git 2.54, Codex CLI 0.164 with `image_generation` = stable/enabled. Windows built-in handwriting fonts: Ink Free, Segoe Print.
- **Rules sources**: officialgamerules.org/game-rules/scrabble; WESPA rules (six consecutive zero scores ends the game); NASPA player rules (exchange only with ≥ 7 tiles in the bag).
