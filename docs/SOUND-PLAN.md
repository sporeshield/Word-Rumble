# Word Rumble — Sound studio plan (Round 3, Phases 27–30)

Tools on this laptop (2026-10-26): **REAPER 7.83** (evaluation) at `C:\Program Files\REAPER (x64)\reaper.exe`, **Vital** VST3 (registered in REAPER) with 75 presets in `Documents\Vital\…`, Node, Python 3.14. No ffmpeg — REAPER renders OGG itself. RAM: 8 GB, often only ~3 GB free.

These are **build tools only**. The game still ships plain `.ogg` files in `resources/sounds/`; nothing about REAPER/Vital reaches the game, and every name stays overridable from `sounds/custom/`.

## Where we are
- `resources/sounds/`: 94 files, 2.3 MB. 70 Kenney CC0 `.ogg` (mostly fine) + **23 own-synth `.wav`** from `scripts/render-sounds.mjs` (22 kHz mono, plain sine/saw maths). The own-synth ones are the weakest: `word-invalid`, `burst-boom-1..3`, `rumble-fanfare`, `buzzer`, `defeat-trombone`, `game-over-fanfare`, `high-score-ding`, `heartbeat`, `power-annoy-1..13`.
- Volumes were never matched: Kenney files, jingles and synth files sit at different loudness.
- Several Kenney picks were chosen by file name, not by ear (Phase 17 note).

## Goals
1. Even loudness across every sound (clicks quiet, booms/jingles loud, nothing clipping).
2. Replace the 23 own-synth sounds with Vital-made ones that sound like a real cartoon game.
3. Listen to everything once and swap the bad picks.
4. A few new sounds (KABLAM burst set, more burst variety); optional title music only if Shane wants it.
5. Stay well under 4 MB and keep RAM low while making them.

## Low-RAM, "headless as possible" rules
REAPER has no true headless mode, but it can render a project from the command line and quit. Vital costs most of its RAM in its OpenGL editor window, so we never open it.
- **Never open the Vital GUI.** Presets go in as plug-in state written by our script, not by clicking.
- **Separate lean REAPER config** for rendering: `reaper.exe -cfgfile <studio ini> -nosplash -renderproject <file>.rpp`. That ini uses the Dummy audio device, no undo history, no peak files, no media explorer. Shane's normal REAPER setup is not touched. (This ini is generated into `.cache/studio/`, git-ignored.)
- **One sound per render, one Vital instance, one track.** Renders run one after another, so RAM stays flat (~250–400 MB) however many sounds we make. Offline render is faster than real time.
- **Mono, 44.1 kHz, OGG** straight out of REAPER. Loudness normalising and silence trim are REAPER render options, so no extra tools.
- During a render session: close Chrome and VS Code, and don't run Codex at the same time.
- If the evaluation "Still evaluating" screen blocks command-line renders, fall back to **one REAPER kept open, minimised**, running a small Lua watcher script (`defer` loop) that picks up job files from `.cache/studio/jobs/`, renders and writes a done file. Shane clicks the nag once per session.

## Pipeline (all in `scripts/studio/`, Node + a little Lua)
- `studio/recipes.json` (committed): one entry per sound → output name, Vital preset (relative to the Vital user folder, found from `%USERPROFILE%\Documents\Vital`; `VITAL_DIR` env overrides), preset tweaks (JSON paths in the `.vital` file, e.g. envelope release, macro values), notes (pitch, start, length, velocity, pitch bend for trombone/slide whistle), optional REAPER FX (ReaEQ/ReaComp/ReaVerbate, free with REAPER), length, loudness target, 1–3 **variants** to compare.
- `build-rpp.mjs`: writes a plain-text `.rpp` per variant — one track, Vital with its state chunk, a MIDI item from the notes, render settings (OGG mono, normalise, trim). `.vital` presets are JSON, so tweaks are simple edits before encoding.
- `render.mjs`: finds `reaper.exe` (`REAPER_EXE` env, else the Program Files path), renders variants one by one into `.cache/studio/out/<name>--A.ogg` etc., prints sizes and peak/loudness.
- `promote.mjs <name> <variant>`: copies the chosen file into `resources/sounds/<name>.ogg`, removes the old `.wav`, moves the name from `OWN_SOUNDS` to a new `STUDIO_SOUNDS` list in `sound-map.mjs` (so `render-sounds.mjs` / `fetch-assets.mjs` never regenerate or overwrite it), adds a CREDITS line ("made in REAPER + Vital, preset by …").
- **Soundboard dev page** `/soundboard.html` (like `/gallery.html`, Codex-built): every sound name grouped by screen, Play current / A / B / C, a loudness bar, and a "Copy my picks" button giving JSON like `{"burst-boom-1":"B"}` to paste to Claude.

## Starting preset ideas (by ear later)
| Sound(s) | Try first |
|---|---|
| `burst-boom-1..3`, `countdown-boom` layer | Big Stomp, THUNK, Thumpus, Kick Drum 1, Destruction (low note, short) |
| `heartbeat` | Kick Drum 1 / Thumpus, low-passed, two hits |
| `rumble-fanfare`, `game-over-fanfare` | Damped Horn, Distant Majestic Lead, Strings Section |
| `high-score-ding`, `hint-ghost` | Cinema Bells, Crescendo Bells, E4 One Note Metallophone |
| `defeat-trombone` | Damped Horn with a downward pitch bend |
| `buzzer`, `word-invalid` | Honk Wub, Growl Bass Sidechain (short), Touch Tone |
| `power-annoy-*` (silly pool) | Honk Wub, Banana Wob, Squish Clicker, Ah Eh Ee Oh (kazoo / "nyah-nyah"), Touch Tone, Special Glitch Thing, Simple Weoum (slide whistle), Fun Pulse |
| new KABLAM / extra bursts | Railgun, VLT Future Gun, Disrupt, Feeder |
| optional title music | Fun Pulse, Super Nice Pluck, Float Chords, Easy Mallet |

## Phases
| # | Phase | Who |
|---|---|---|
| 27 | **Studio spike + pipeline.** Check `-renderproject` under the eval licence (else build the Lua watcher); capture Vital's state chunk from one hand-made `.rpp` and confirm we can write it from a `.vital` file; lean render ini; `build-rpp` / `render` / `promote`; render one test boom and measure RAM. `.cache/studio/` git-ignored. | Claude (scripts), Shane clicks once if the nag appears |
| 28 | **Loudness + listening pass.** Codex builds `/soundboard.html`. Run every existing sound through REAPER with loudness targets per group (UI ≈ −22 LUFS, tiles/dialogs ≈ −18, bursts/jingles/booms ≈ −14, peak ≤ −1 dB) and trim silence; Shane listens and flags bad Kenney picks; fix them in `sound-map.mjs`. | Codex page, Claude pipeline, Shane's ears |
| 29 | **Vital replacements** for the 23 own-synth sounds, 2–3 variants each, picked on the soundboard and promoted. Annoying pool stays family-friendly, 0.8–2 s, and never hints at a power type. | Claude recipes, Shane picks |
| 30 | **New sounds + wrap-up.** KABLAM burst set and 2–3 more burst variants; optional title music only if Shane says yes (streamed with an `<audio>` element and a Settings switch, never decoded into the `sfx` preload); `sounds/custom/README`, CREDITS, size check (< 4 MB), `pnpm package`, quick play-through with sound. | Claude, Codex for any UI |

## Checks every sound phase
- `pnpm test`, `pnpm typecheck`; total `resources/sounds` size; decoded preload size (sfx decodes everything at start — keep each effect short).
- Drop a file into `sounds/custom/` and confirm it still overrides the new built-in.
- Never touch `Word Rumble/data/`.
