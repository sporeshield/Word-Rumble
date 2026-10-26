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
- `pnpm package` (electron-builder `--dir`) produces a **self-contained playable folder `Word-Rumble/Word Rumble/`** with `Word Rumble.exe` + the Electron runtime — no Node, pnpm or internet needed to play, works on any Windows PC and any drive letter.
- **Everything the game saves lives inside that folder**: `Word Rumble/data/word-rumble.sqlite` (scores, autosave, settings, custom words), `Word Rumble/data/electron/` (Electron's own cache — `app.setPath('userData', …)` so nothing goes to AppData), and `Word Rumble/sounds/custom/`. All paths are worked out at runtime from the exe's own location; no absolute path is ever stored.
- Re-packaging after code changes only replaces the app files — `data/` and `sounds/custom/` are never touched, so scores survive updates.
- Desktop shortcut: on first launch (and in Settings) the game offers **"Create desktop shortcut"** (`shell.writeShortcutLink` to the current exe, tile icon). If it's launched from a new location (e.g. the external drive) and the existing shortcut points somewhere else, it offers to fix it.
- Dev project is movable too: `.npmrc` `node-linker=hoisted` (no pnpm junctions with absolute paths); dev runs use a separate `Word-Rumble/dev-data/` so testing never pollutes real scores. After a move, only development needs `pnpm install` — playing doesn't.

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
Word-Rumble/
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
- Phase 0 was done in the planning session (Opus); all later phases run on Sonnet 5.5 medium from inside the `Word-Rumble` folder.
- **Phase 0** sets up the hand-off so every later session starts cold and cheap:
  - `Word-Rumble/.claude/settings.json` → `"model": "claude-sonnet-5-5"`, `"effortLevel": "medium"` (project setting overrides the user-level Opus default; the user settings already map Sonnet 5.5 → medium).
  - `Word-Rumble/docs/PLAN.md` — this plan, copied into the project.
  - `Word-Rumble/docs/PROGRESS.md` — phase checklist; each finished phase gets ✅ plus 2–5 lines of hand-off notes (files made, decisions, anything left).
  - `Word-Rumble/CLAUDE.md` — short project rules: read PROGRESS.md first, open only the PLAN.md sections the current phase needs, do **one phase only**, delegate images/visuals to Codex, run tests, update PROGRESS.md, git commit, then stop and say "Phase N done — type `/clear`, then `/next-phase`".
  - `Word-Rumble/.claude/commands/next-phase.md` — the `/next-phase` slash command that kicks off the next unchecked phase.
  - `git init` (local only, no remote) so each phase ends with a checkpoint commit.
  - Save memory notes about these working preferences.
- **From Phase 1 on**: start Claude Code **inside `C:\NextJS_Projects\Scrabble`** (`cd C:\NextJS_Projects\Scrabble` then `claude`) so the Sonnet 5.5 medium project default applies; between phases type `/clear` then `/next-phase`.
- **Codex does as much as possible** via the Codex plugin (`codex:rescue` → Codex CLI 0.164, `image_generation` enabled): **all image creation**, all visual components/CSS/animation, and an independent review pass on the bigger code phases. Claude writes the brief, checks the result, wires it in, runs tests.
- Generated art lives in `resources/art/` as optimised WebP/PNG (transparent where needed); no text baked into images — titles/labels are rendered with the bundled fonts so they stay crisp.

## Phases (each sized for one session, then `/clear`)
Phases 15–26 are **Round 2**; their details are in the "Round 2 — family requests" section below (R2-1 … R2-11).

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
| 15 | **Round 2 starts.** Quit without saving; default player names in Settings; "Start afresh"; serialise autosave/clear; hide the computer's points in the turn banner (R2-1, R2-2) | Claude, Codex dialog look |
| 16 | Penalty costs: Hint, Shuffle and Swap each cost a random 1–10 points, quoted before you confirm, locked per turn; Setup toggles (R2-11) | Claude, Codex dialog look |
| 17 | Sound pack 2: Kenney voiceover + music jingles, more picks from the cached packs, own synth heartbeat/boom, the **annoying power-play pool**; `sfx` playback-rate option; sound-map, CREDITS, `sounds/custom` README (R2-3) | Codex scripts, Claude runs & checks by ear |
| 18 | Nervous countdown 10 → 0 + **BOOM!!** on timeout; timer survives Continue (R2-4) | **Codex** visuals/animation, Claude wiring |
| 19 | New play-screen layout from the approved mockup: upright rack beside the board, Left/Right chosen in Setup (current player only), Players row, square key, ×2/×3 labels, Codex-drawn upright holder (R2-5, R2-6) | **Codex** CSS + art, Claude checks in a running window |
| 20 | Engine: 2–4 players, ranking, drop out (+ give points to a chosen player), Gift to a chosen player, majority vote, `normaliseGame` wired into `parseSaved` + old-save tests (R2-7) | Claude, **Codex review** |
| 21 | 2–4 players, data: DB migration 2 (rank, given away), `GameRecord`/`record.ts`, head-to-head + recent games by rank, structured Notebook rows; migration tested on a COPY of the real DB (R2-8a) | Claude |
| 22 | 2–4 players, flow: Setup (count, names, colours), first draw / deal / handoff loops, Players row with up to 3 others, hidden-DOM checks (R2-8b) | Claude, Codex visuals |
| 23 | 2–4 players, dialogs + results: recipient picker, drop-out dialog, private multi-player vote, Game over ranking, Notebook, e2e 3-player run (R2-8c) | **Codex** visuals, Claude wiring |
| 24 | Engine: Wild power squares — players choose 0–4 of each power type, fair random placement, scoring/preview/move generator/worker/Board read the layout, new burst tiers + old-save upgrade + vitest (R2-9) | Claude, **Codex review** |
| 25 | Wild power squares UI: Setup steppers, square looks, key counts, start-of-game reveal, annoying random power sounds, KABLAM bursts (R2-9, R2-10) | **Codex** visuals/animation, Claude wiring |
| 26 | Round 2 ship: Codex final review, `pnpm package`, e2e, real-DB-copy upgrade check, manual play-through checklist (4 players, Wild, timer, penalties), move + offline check | Claude, **Codex final review** |

## Round 2 — family requests (planned 2026-10-26)
Asked for by Shane after the first full build. Each R2 item below is referenced from Phases 15–26. All earlier rules still apply: hidden racks, **hidden scores** (no other player's total in the DOM until Game over — this now covers 3 opponents, gift amounts received and drop-out totals), sound on every action, portable, offline, engine stays pure.

**R2-1 Quit without saving.** Pause menu gets a third button "Quit without saving" under "Save & quit to title" → cartoon confirm ("This game will be lost — nobody's score is recorded") → clears the autosave (`savedGame.clear()`), nothing written to the notebook, back to Title. Sound: `quit-nosave` (sad whoosh). Different from Admit defeat (that records the game). No scores shown in the dialog. **Fix first (Codex review):** App.tsx fires `savedGame.save/clear` without awaiting (App.tsx ~73), so a late save could bring a quit game back — serialise save/clear/reset through one promise queue and drop the in-memory Continue state at once. Also in this phase: the post-turn banner currently shows the computer's points (Game.tsx ~128/477) — hide them (only the mover's own points, and only to a human mover).

**R2-2 Default player names + Start afresh.** Settings gets a "Players" section: four name fields (defaults Shane, Dawn, Player 3, Player 4) saved as setting `defaultNames`; "Back to Shane & Dawn" button. `loadSetup` / Setup placeholders read these instead of the constant (the constant stays as the fallback). Names typed on Setup still only change that game's setup. **Start afresh** button (for handing the folder to family): confirm dialog → clears scores, autosave and default names; tick-box "Also forget words we added to the word list" (off by default). Never touches files outside the game's `data/` folder. New main/IPC: `scores.reset` already exists; add `words.clearCustom()` and `settings.delete(key)`. Clearing custom words must also update the live `WordService` (main/words.ts) and rebuild the shared move-finder worker (`ai/shared.ts`), not just the DB.

**R2-3 Sound pack 2** (all CC0, offline, in `resources/sounds/`, every name overridable from `sounds/custom/`):
- Download in `fetch-assets.mjs` (cache in `.cache/`): Kenney **Voiceover Pack** `https://kenney.nl/media/pages/assets/voiceover-pack/3f7f168698-1677589897/kenney_voiceover-pack.zip` (`Male/` + `Female/`: `1`–`10`, `go`, `hurry_up`, `time_over`, `power_up`, `level_up`, `you_win`, `its_a_tie`, `new_highscore`, `congratulations`, `final_round`; voices credited in its `Credits.txt`) and Kenney **Music Jingles** `https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip` (8-bit / hit / pizzicato / sax / steel jingles, 85 files).
- New named sounds (pick by ear; first choice → fallback like Phase 2): `count-1`…`count-10` + `count-time-over` (voice, played with `varyPitch: false`; Settings choice Voice: Female / Male / Off, default Female), `heartbeat` (own synth, two-thump), `countdown-boom` (`sci-fi-sounds/lowFrequency_explosion_000` layered with own synth boom), **annoying power-play pool `power-annoy-1` … `power-annoy-12`+** (see R2-10: air horn, clown honk, kazoo fanfare, slide whistle, duck quack, rubber-chicken squawk, siren whoop, vuvuzela blast, boing-boing, "nyah-nyah" taunt tune, cowbell frenzy, cuckoo, drum roll + crash, voice `power_up` at a goofy pitch — own synth in `render-sounds.mjs` and/or CC0-only recordings with the source URL in CREDITS; family-friendly, loud and silly, ~0.8–2 s each), `penalty-cost` (coin-drop / reverse ka-ching for a cost quote), `power-reveal` (`sci-fi-sounds/forceField_*`), `power-preview` (one neutral soft chime when a tile lands on ANY power square), `voice-power-up`, `drop-out` (sax "wah" jingle), `gift-given` (pizzicato jingle), `quit-nosave`, `player-joins` (Setup adds player 3/4), `rank-reveal` (Game over places), and swap `game-over-fanfare` / `high-score-ding` for jingles only if they sound better.
- `sfx.play` gains a `rate` option (fixed playback rate, no random pitch) for the speeding heartbeat (sfx.ts ~79).
- Size: check the decoded preload memory too, not just file size — `sfx` decodes every listed sound at start (sfx.ts ~34); trim long jingles. Voiceover performers (Jeffrey M. Smith, Giselle — from the pack's `Credits.txt`) go into CREDITS.md.
- Note: a broken `sounds/custom` file currently replaces the built-in entirely (main/sounds.ts ~20); make the built-in the fallback if decoding the custom one fails.
- Keep total sound size modest (target < 4 MB for the whole folder); CREDITS.md and the `sounds/custom/README` name list updated.

**R2-4 Nervous countdown + BOOM!!** (timer games only; human turns only; never during handoff, pause, dialogs that stop the timer, or the computer's turn):
- At 10 s left the `TurnTimer` grows and moves forward (bigger ring + huge Bangers digits), turns gold → orange → red as it falls, and **pulses every second** like a heartbeat (squash-and-stretch pop on each number, scale and shake increasing toward 0, a faint red vignette pulsing round the screen edge, sweat-drop/wobble doodles optional). Respect `prefers-reduced-motion` (colour + digits only).
- Sound each second: `heartbeat` (playback rate rising from 1.0 to ~1.4) plus the voice count `count-10` … `count-1` (if Voice ≠ Off); replaces the old `timer-tick`.
- At 0: giant fixed **"BOOM!!"** comic burst (top-tier look, not from the burst deck so it never uses up a deck word), screen shake + white flash, `countdown-boom` + `count-time-over`, then the existing timeout (pending tiles fly back, 0 points). Replaces the buzzer.
- **Timer survives Continue**: today the clock is React state only (Game.tsx ~99), so Continue restarts the turn. Store `turnSecondsLeft` in the autosave when pausing/saving and resume from it (fresh full timer after a handoff is still fine).
- Pure helper `countdownStage(seconds)` (→ calm / nervous level 1–10 / boom) in `screens/game/` with a vitest so the look and sound rules are testable.

**R2-5 New play-screen layout** (mockup approved 2026-10-26: `docs/mockups/play-mockup.html`, screenshots `docs/mockups/mock-*.png`, before = `current-*.png`).
- **Rack side is a Setup choice: "Rack: Left / Right"** (default **Left**, remembered with the setup like the other options; `SetupConfig.rackSide`, upgraded in `loadSetup`). Left = rack on the far left, then the board, then the panel (mockup `?side=left`, `mock-a-left-1920x1080.png`); Right = board, rack, panel (mockup default). One CSS class on the play screen flips the order — no duplicated markup. It applies to the whole game, not per player, so the screen doesn't jump around between turns. The rack shows **only the current player's** 7 tiles top-to-bottom, tiles as big as the height allows (mockup: ~110 px at 1920×1080, ~87 px at 1366×768 vs board squares 65 / 46 px). Player name on a painted name plate on the front/bottom of the holder.
- Right panel: turn header + own score (high-contrast) + bag-count pill + timer ring; **Players row** = the other players as small name plates in their colour with a mini tile back and "7 tiles" (no scores, never letters); **Square key** (swatch + label for every type on this board; power types highlighted with "· 2 on board" counts); live preview; Play (big) + Recall/Shuffle/Swap/Pass/Hint/Pause/Admit defeat.
- Fixes from the mockup review: the upright holder must be a proper cartoon wooden holder tinted in the player's colour (Codex draws `rack-holder-upright.webp` + tint mask; no text baked in); the Players subtitle and "Your score" must be readable on the halftone header.
- Rack reorder/drag works vertically (`data-rack-slot`; arrow keys Up/Down as well as Left/Right). Face-down state (handoff, wheel, dialogs) shows tile backs only, as now. `Rack.hidden.test.tsx` still passes; other players' racks are no longer rendered at all (counts only).

**R2-6 Square labels** (built in Phase 19 with the layout). Drop the L: letter squares show **×2 / ×3**, word squares **×2 / ×3 with a small "WORD" tag** underneath; colours stay the main cue (aqua/electric-blue letters, bubblegum/tangerine words). Burst tiers and aria-labels updated ("double letter", "triple word").

**R2-7 Engine for 2–4 players** (`engine/game.ts`):
- `GameOptions.names` length: solo 1, computer 2, two (shown as "Friends") **2–4**. Mode value stays `'two'` so old saves and DB rows still match.
- `scorelessLimit(n)` = 6 for two players, 3 × n otherwise (one full silent round of three each); solo stays 3.
- Result: `ranking: number[][]` (places, ties share a place; tie-break by pre-adjust score as now); `winner` kept as `ranking[0]` if single, else null, for older code.
- **Drop out** (was Admit defeat with 3–4 players): action `{ type: 'concede', recipient: number | null }` → the dropper chooses another active player to receive their current score, or nobody. The score moves to the recipient (dropper's final score 0, `givenAway` = the amount, so nothing is counted twice); with "nobody" they keep it. their rack goes back in the bag; they are skipped from then on (`PlayerState.out = true`). When one active player remains the game ends (`reason: 'conceded'`). Two players: conceding works exactly as before (other player wins; recipient not asked). Ranking puts dropped players last, in drop order (latest drop ranks higher).
- **Gift** slice: `play` action gains `recipient` — the mover picks any other active player; two players = the only opponent automatically.
- **Convince them!** slice: every other active player votes; majority 👎 = zero points, tie or majority 👍 = keep. Action carries `votes: ('keep'|'zero')[]`.
- Replace the two-player code: `winner = 1 - conceder` and the 0-vs-1 score compare in `endGame` (game.ts ~223); Gift currently credits **every** other player (game.ts ~327) → only the recipient. `advance()` skips `out` players. Scoreless limit uses the number of **active** players at the time; dropping out does not reset or add to the scoreless count.
- Skip-next-turn, go-out adjustments, first draw, exchange/bag rules already work for N; add tests for 3 and 4 players (turn order with skips + drop-outs, out bonus from three racks, ranking ties, gift recipient, vote majority, scoreless limit).
- Loading old saves: a two-player save without `ranking`/`out` still continues — `normaliseGame()` fills the defaults and **must be called from `parseSaved()` in App.tsx** (~27) before Continue uses the save; test with a real old-format save JSON.

**R2-8 2–4 players in the app.**
- **(Phase 21 — data)** DB, record and Notebook data first, see the DB bullet below; `recentGames` must return players ordered by rank as structured rows (JSON), not the `name:score:winner|…` string (names can contain `|`; notebook-format.ts ~14).
- **(Phase 22 — flow)** Setup "Friends" mode: player count 2 / 3 / 4 (chunky buttons, `player-joins` sound), a name + colour row per player (no duplicate colours; defaults teal, violet, orange, pink; names from R2-2). `SetupConfig.names/colors` become 4-long arrays + `players: 2|3|4`; `loadSetup` upgrades old 2-long configs. vs Computer stays one human + one computer.
- App.tsx builds exactly two colours (~156) and `playerNames` takes two names (screens/types.ts ~35) — make both N-long.
- First draw, deal and handoff loop through every player (handoff shows the next player's name/colour only). Play screen: current player's rack big at the front; the others small and face-down with name plate + tile count (no letters, no scores).
- DB migration 2: `game_players.rank INTEGER`, `given_away INTEGER DEFAULT 0`, `gift_to TEXT`; backfill rank from `winner` per game: winner 1, the other 2; if **no** player in a two-player game has `winner = 1` it was a draw → both 1. Opening the DB migrates and saves at once (db.ts ~38), and the e2e test skips `data/`, so: copy the real `Word Rumble/data/` to a temp folder, open the copy with the new code, compare `user_version`, row counts, old head-to-head tallies and ranks. Head to Head = every pair that played the same game (any player count): a beats b when `rank_a < rank_b`. Top Scores filter label "Two-player" → "Friends". `GameRecord.players[].rank`. **Test the migration on a copy of the real `Word Rumble/data/` DB before shipping** — never on the original.
- **(Phase 23 — dialogs + results)** Hidden-DOM rule for every dialog/handoff where someone else may look (recipient picker, drop-out, each voter's turn): the current rack **and** the pending tiles on the board, the live preview text and the Play button's point value must all be removed (today `hidden` only covers wheel/vote and the preview/Play button still render, Game.tsx ~112/385/412). Add a DOM test.
- Dialogs (Codex look): "Who gets the points?" recipient picker (name plates in player colours, no scores), drop-out confirm with recipient picker + "Nobody", multi-player vote (each voter in turn presses 👍/👎 with the screen covered between voters so votes are private). Game over: podium 1st–4th, dropped players shown as "dropped out — gave N to Dawn", confetti on 1st. Notebook Recent Games lists all players by place.
- e2e: add a 3-player game (one drop-out with a gift) to `tests/e2e`.

**R2-9 Wild power squares** (optional per game; Setup "Board: Classic / Wild", default Classic):
- Five power types, each with a **0–4 stepper in Setup** (players decide before the game; defaults ×5 letter 2, ×10 letter 2, ×4 word 1, ×5 word 2, ×10 word 2; "Surprise me" randomises the counts; saved with the setup): **×5 POWER letter, ×10 POWER letter, ×4 WORD, ×5 POWER WORD, ×10 POWER WORD.** Mockup: `play-mockup.html?v=b` and `?v=setup`.
- Added on top of the Classic layout (nothing removed), on random **plain** squares, new positions every game (crypto RNG). Fair spread: power squares dealt round-robin across the four quadrants (so no side of the board gets them all), never the centre or next to the centre star, never adjacent to another power square, no two of the same type in one row or column. Pure placement helper tested over many seeds; if the constraints can't be met (large counts) it relaxes adjacency first, never the centre rule.
- Scoring: letter multipliers before word multipliers as now; word multipliers stack (a word over ×10 WORD and ×3 WORD = ×30). Only newly placed tiles trigger them.
- Places that read the fixed layout today and must take `game.layout`: `scoring.ts`, `turnview.ts` preview, `components/Board.tsx` (~38 maps `PREMIUM_LAYOUT`), `components/Square.tsx` (exhaustive label/aria map, ~14), both `MoveFinder.find()` callers in Game.tsx (~160 computer, ~332 hint) → `client.ts` request → `ai.worker.ts` → `generateMoves`. `rules.ts` is geometry-only and needs no layout.
- Saved `bursts` decks lack the new tiers and `drawBurst` assumes every tier exists (fx/bursts.ts ~45) → upgrade decks in `normaliseGame` + test.
- New `Premium` values `PL5`, `PL10`, `QW`, `PW5`, `PW10`; `GameState.layout: Premium[][]` + `options.power: {pl5, pl10, qw, pw5, pw10}` (JSON-safe, autosaved). `PREMIUM_LAYOUT` stays as the Classic layout. Old saves without `layout` = Classic.
- Burst tiers `power5`, `power10`, `quad`, `powerword5`, `powerword10` (~20 words each, no repeats per game, borrow from `top` if dry), e.g. POWER UP!, SUPERCHARGED!, TURBO! · MEGA POWER!, OFF THE CHARTS!, TEN-TASTIC! · KABLAM!, QUADRUPLE KABLAM!, FOUR-MIDABLE! · WORD QUAKE!, MEGA-BLAMMO! · TOTAL MELTDOWN!, KA-TEN-BOOM!, NUCLEAR WORD!. Priority powerword10 > power10 > powerword5 > quad > power5 > existing tiers. Tests: placement constraints across many seeds, scoring on each new square (letter before word, stacked word multipliers), move generator matches engine scores on a Wild layout.

**R2-10 Wild squares on screen + the annoying power-play sounds.**
- Square looks (Codex; mockup `?v=b`): ×5 POWER letter hot yellow + lightning; ×10 POWER letter gold/white pulsing glow; ×4 WORD deep purple sparkle; ×5 POWER WORD electric red/black starburst; ×10 POWER WORD black with a rainbow/fire rim. Labels "×5"/"×10" + small POWER, "×4"/"×5"/"×10" + small WORD. Gentle idle shimmer (off with reduced motion).
- Square key on the right lists each type on this board with its count; power types highlighted.
- Start of a Wild game: "POWER SQUARES ARE LIVE!" burst + `power-reveal` + `voice-power-up` while the power squares flash.
- **Power-play sounds are deliberately secret and a nuisance:** whenever a scored play hits ANY power square, play a random sound from the shared **annoying pool** (`power-annoy-*`; no immediate repeat, no repeat until the pool is used up — keep the deck position in game state like bursts). Loud and silly, so the players waiting for the laptop hear that *something* big happened but **can't tell which power square or how many points**. Never map a sound to a power type. A play hitting 2+ power squares may chain two random pool sounds. These replace the normal burst sound for that play.
- Only the mover sees the bigger KABLAM burst (power-specific word, extra shake, flash, confetti) and their own points; the next player only discovers the play on the board after "Let's go!".
- `power-preview` is one neutral chime for any power square, so even previews don't give the type away.

**R2-11 Penalty costs for Hint, Shuffle and Swap** (Setup "Penalties": Hints Off / Free / Costs 1–10; Shuffle Free / Costs 1–10; Swap Free / Costs 1–10; defaults: costs on for all three; mockup `?v=c`):
- Pressing Hint, Shuffle or Swap rolls a random cost **1–10** (crypto RNG, dice animation) and shows a cartoon warning **before** anything happens: "Shuffling your rack will cost you 7 points" → **Shuffle (−7)** / **No thanks**; Swap: "Swapping costs 4 points and ends your turn" → pick tiles → **Swap (−4)**. The quote is **locked for the turn** (declining and re-pressing shows the same number, like the hint lock today); each accepted shuffle rolls a fresh quote for the next one.
- Engine: hint costs change from 5–30 to 1–10 (`HINT_COST_MIN/MAX` in penalties.ts); new actions `shuffle-offer` / `shuffle-accept` (records the cost; the rack order itself stays a UI matter) and `exchange` carries the quoted `cost`; `PlayerState` gains `shufflePointsLost` and `swapPointsLost`; history records them. One rule for all three about going below 0 (same as hints today). Old saves default the new fields to 0.
- Hidden scores: the quote shows only the cost, never a total. The computer never shuffles; its swaps pay the same rolled cost silently.
- Hall of Shame adds "points lost to shuffles / swaps". Sounds: `penalty-cost` on the quote, `ui-click` on decline.

Decisions taken while planning (change them in the phase if Shane says otherwise): WORD tag on word squares; Wild squares are added, not replacing, and players choose 0–4 of each power type; names edited in Settings; Gift recipient is chosen by the mover; dropping out lets the dropper give their score to a chosen player; countdown voice defaults to Female; vs Computer stays 1 v 1; power-play sounds come from one shared random pool so they never reveal the type; Hint/Shuffle/Swap cost 1–10.

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
