// Exact paths in Kenney's six CC0 audio archives. The first match wins;
// subsequent choices keep a sound available if a particular pack is offline.
export const PACKS = {
  'impact-sounds': 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
  'casino-audio': 'https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip',
  'interface-sounds': 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
  'ui-audio': 'https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip',
  'digital-audio': 'https://kenney.nl/media/pages/assets/digital-audio/216eac4753-1677590265/kenney_digital-audio.zip',
  'sci-fi-sounds': 'https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip',
  'voiceover-pack': 'https://kenney.nl/media/pages/assets/voiceover-pack/3f7f168698-1677589897/kenney_voiceover-pack.zip',
  'music-jingles': 'https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip',
};

const source = (pack, file) => [pack, `Audio/${file}.ogg`];
const voice = (gender, file) => ['voiceover-pack', `${gender}/${file}.ogg`];
const jingle = (kind, number) => ['music-jingles', `Audio/${kind} jingles/jingles_${kind === '8-Bit' ? 'NES' : kind.toUpperCase().replace('PIZZICATO', 'PIZZI')}${number}.ogg`];

// Round 2 sound pack: Kenney voiceover (female default, `male-` set), jingles and a few more picks.
// Voiced names are listed in VOICED so the Settings voice choice can swap or silence them.
const countVoices = {};
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  countVoices[`count-${n}`] = [voice('Female', String(n))];
  countVoices[`male-count-${n}`] = [voice('Male', String(n))];
}
export const VOICED = [...Array.from({ length: 10 }, (_, i) => `count-${i + 1}`), 'count-time-over', 'voice-power-up'];
const maleVoices = Object.fromEntries(VOICED.map((name) => [`male-${name}`, [voice('Male', name === 'count-time-over' ? 'time_over' : 'power_up')]]));

export const SOUND_SOURCES = {
  'ui-hover': [source('ui-audio', 'rollover1'), source('interface-sounds', 'select_001')],
  'ui-click': [source('ui-audio', 'click1'), source('interface-sounds', 'click_001')],
  'ui-toggle': [source('interface-sounds', 'toggle_001'), source('ui-audio', 'switch1')],
  'tile-pickup': [source('casino-audio', 'chips-handle-1'), source('interface-sounds', 'pluck_001')],
  'tile-drag-tick': [source('interface-sounds', 'tick_001'), source('ui-audio', 'rollover2')],
  'tile-place': [source('impact-sounds', 'impactWood_light_000'), source('casino-audio', 'chip-lay-1')],
  'tile-return': [source('impact-sounds', 'impactWood_light_001'), source('casino-audio', 'chip-lay-2')],
  'recall-all': [source('casino-audio', 'chips-collide-1'), source('interface-sounds', 'drop_001')],
  'rack-shuffle': [source('casino-audio', 'card-shuffle'), source('interface-sounds', 'scroll_001')],
  'rack-reorder': [source('casino-audio', 'chip-lay-1'), source('interface-sounds', 'drop_002')],
  'blank-chosen': [source('interface-sounds', 'confirmation_001'), source('ui-audio', 'click2')],
  exchange: [source('casino-audio', 'card-shove-1'), source('interface-sounds', 'switch_001')],
  pass: [source('interface-sounds', 'back_001'), source('ui-audio', 'switch2')],
  'bag-shake': [source('casino-audio', 'dice-shake-1'), source('interface-sounds', 'scratch_001')],
  'first-draw-reveal': [source('interface-sounds', 'open_001'), source('digital-audio', 'highUp')],
  'flip-see': [source('casino-audio', 'card-place-1'), source('ui-audio', 'switch3')],
  'flip-hide': [source('casino-audio', 'card-place-2'), source('ui-audio', 'switch4')],
  'word-valid': [source('interface-sounds', 'confirmation_002'), source('digital-audio', 'threeTone1')],
  'timer-tick': [source('interface-sounds', 'tick_002'), source('ui-audio', 'click3')],
  pause: [source('interface-sounds', 'minimize_001'), source('digital-audio', 'lowDown')],
  resume: [source('interface-sounds', 'maximize_001'), source('digital-audio', 'highUp')],
  'dice-roll': [source('casino-audio', 'dice-throw-1'), source('interface-sounds', 'scratch_002')],
  'hint-ghost': [source('interface-sounds', 'question_001'), source('digital-audio', 'powerUp1')],
  'page-flip': [source('casino-audio', 'card-fan-1'), source('interface-sounds', 'scroll_002')],
  'pencil-scribble': [source('interface-sounds', 'scratch_001'), source('casino-audio', 'card-slide-1')],
  'wheel-spin': [source('sci-fi-sounds', 'engineCircular_000'), source('casino-audio', 'dice-shake-2')],
  'wheel-land': [source('impact-sounds', 'impactWood_medium_000'), source('casino-audio', 'die-throw-1')],
  'burst-zap-1': [source('sci-fi-sounds', 'laserSmall_000'), source('digital-audio', 'zap1')],
  'burst-zap-2': [source('sci-fi-sounds', 'laserSmall_001'), source('digital-audio', 'zap2')],
  'burst-zap-3': [source('sci-fi-sounds', 'laserRetro_000'), source('digital-audio', 'zapTwoTone')],
  'burst-pow-1': [source('impact-sounds', 'impactPunch_heavy_000'), source('sci-fi-sounds', 'explosionCrunch_000')],
  'burst-pow-2': [source('impact-sounds', 'impactPunch_heavy_001'), source('sci-fi-sounds', 'explosionCrunch_001')],
  'burst-pow-3': [source('impact-sounds', 'impactPunch_heavy_002'), source('sci-fi-sounds', 'explosionCrunch_002')],
  'burst-whoosh-1': [source('sci-fi-sounds', 'thrusterFire_000'), source('digital-audio', 'phaserUp1')],
  'burst-whoosh-2': [source('sci-fi-sounds', 'thrusterFire_001'), source('digital-audio', 'phaserUp2')],
  'burst-crash-1': [source('sci-fi-sounds', 'explosionCrunch_000'), source('impact-sounds', 'impactWood_heavy_000')],
  'burst-crash-2': [source('sci-fi-sounds', 'explosionCrunch_001'), source('impact-sounds', 'impactWood_heavy_001')],
  ...countVoices,
  'count-time-over': [voice('Female', 'time_over')],
  'voice-power-up': [voice('Female', 'power_up')],
  ...Object.fromEntries(Object.entries(maleVoices).filter(([name]) => !(name in countVoices))),
  'countdown-boom': [source('sci-fi-sounds', 'lowFrequency_explosion_000'), source('sci-fi-sounds', 'lowFrequency_explosion_001')],
  'penalty-cost': [source('casino-audio', 'chips-collide-2'), source('impact-sounds', 'impactBell_heavy_000')],
  'power-reveal': [source('sci-fi-sounds', 'forceField_000'), source('sci-fi-sounds', 'forceField_001')],
  'power-preview': [source('impact-sounds', 'impactBell_heavy_001'), source('interface-sounds', 'confirmation_003')],
  'drop-out': [jingle('Sax', '05'), jingle('Sax', '01')],
  'gift-given': [jingle('Pizzicato', '03'), jingle('Pizzicato', '01')],
  'quit-nosave': [source('sci-fi-sounds', 'thrusterFire_002'), source('digital-audio', 'phaserDown1')],
  'player-joins': [source('interface-sounds', 'bong_001'), source('ui-audio', 'click4')],
  'rank-reveal': [source('impact-sounds', 'impactPlate_light_000'), source('interface-sounds', 'select_002')],
};

export const OWN_SOUNDS = [
];

// Made in REAPER + Vital by scripts/studio (promote.mjs); never regenerated by render-sounds.mjs.
export const STUDIO_SOUNDS = [
  'burst-boom-1',
  'burst-boom-2',
  'burst-boom-3',
  'word-invalid',
  'buzzer',
  'defeat-trombone',
  'rumble-fanfare',
  'game-over-fanfare',
  'high-score-ding',
  'heartbeat',
  'power-annoy-1',
  'power-annoy-2',
  'power-annoy-3',
  'power-annoy-4',
  'power-annoy-5',
  'power-annoy-6',
  'power-annoy-7',
  'power-annoy-8',
  'power-annoy-9',
  'power-annoy-10',
  'power-annoy-11',
  'power-annoy-12',
  'power-annoy-13',
];
