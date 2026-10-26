# Word Rumble

A cartoon crossword-tile word game for 1–4 players (or against the computer), made with Electron, React and TypeScript. It runs fully offline on Windows.

Word Rumble is an independent game. It is not affiliated with or endorsed by the makers of any other word game, and it uses its own board layout, tile set and scoring.

## Features

- Solo run, 2–4 players on one screen (pass the laptop), or vs Computer (Easy / Medium / Hard)
- Hidden racks and hidden scores: you only ever see your own, until Game over
- Optional timer with a nervous countdown and a BOOM
- Penalty wheel for made-up words, plus costly hints, shuffles and swaps
- Classic or **Wild** board with power squares (×5/×10 letters, ×4/×5/×10 words)
- Comic-book bursts, confetti, around 100 sounds
- Notebook with top scores, head to head, best plays, recent games and a hall of shame
- Portable: everything lives in the game folder (word list, fonts, sounds, art, scores)

## Run it

You need [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

```
pnpm install
pnpm dev          # run in development (uses dev-data/ for scores)
pnpm test         # unit tests
pnpm typecheck
pnpm package      # build the portable "Word Rumble/" folder with Word Rumble.exe
pnpm test:e2e     # packaged-app tests (run pnpm package first)
```

## Build your own exe

The repo holds the source code only. The built game (`Word Rumble/` with `Word Rumble.exe`) is not stored here, but you can build it yourself on Windows:

1. Install [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).
2. Get the code: `git clone https://github.com/sporeshield/Word-Rumble.git`, then open a terminal in the new `Word-Rumble` folder.
3. Run `pnpm install`, then `pnpm package`.

This creates a `Word Rumble/` folder with `Word Rumble.exe` inside. Keep the exe together with the rest of that folder (it holds the word list, fonts, sounds and your scores); the whole folder is portable, so you can move it to a USB drive or another PC. The exe is not code-signed. An exe you build yourself runs without a warning, but if you download a built copy from someone else, Windows SmartScreen may show "Windows protected your PC" on first run, because downloaded files are marked as coming from the internet and an unsigned file has no reputation yet. Click **More info**, then **Run anyway**.

Scores are saved in `Word Rumble/data/`. A freshly built folder starts with none, so back that folder up if you want to keep them.

Drop your own sounds into `Word Rumble/sounds/custom/`, named like the built-in ones, to replace them (the packaged folder lists the names).

## Licence and credits

The code is released under the [MIT licence](LICENSE).

Third-party material keeps its own licence:

- Word list: ENABLE (public domain) plus a few newer two-letter words
- Fonts: Bangers and Fredoka (SIL Open Font License, texts in `resources/fonts/`)
- Sounds: Kenney audio packs (CC0) and sounds made with the Vital synthesiser; see `resources/sounds/CREDITS.md`
- Art: generated for this project

The project plan and build notes are in `docs/`.
