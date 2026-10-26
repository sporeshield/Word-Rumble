import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OWN_SOUNDS, SOUND_SOURCES } from './sound-map.mjs';

const rate = 22050;
const sounds = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'sounds');
const tau = Math.PI * 2;
const clamp = (value) => Math.max(-1, Math.min(1, value));
const sine = (phase) => Math.sin(tau * phase);
const saw = (phase) => 2 * (phase - Math.floor(phase)) - 1;
const envelope = (t, duration, attack = 0.012, release = 0.1) =>
  Math.max(0, Math.min(1, t / attack, (duration - t) / release));

function seededNoise(name) {
  let state = 2166136261;
  for (const char of name) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
}

function wav(name, duration, sample) {
  const count = Math.ceil(duration * rate);
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(count * 2, 40);
  const noise = seededNoise(name);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const fade = Math.min(1, t * 200, (duration - t) * 200);
    bytes.writeInt16LE(Math.round(clamp(sample(t, noise) * Math.max(0, fade)) * 32767), 44 + i * 2);
  }
  return bytes;
}

function brass(t, frequency) {
  const phase = t * frequency;
  return (sine(phase) + 0.42 * sine(2 * phase) + 0.19 * sine(3 * phase)) / 1.61;
}

function melody(notes, noteLength, tail = 0.14) {
  const duration = notes.length * noteLength + tail;
  return { duration, sample(t) {
    let sum = 0;
    for (let i = 0; i < notes.length; i++) {
      const local = t - i * noteLength;
      if (local < 0 || local >= noteLength + tail) continue;
      const decay = Math.exp(-2.1 * local / (noteLength + tail));
      sum += brass(local, notes[i]) * envelope(local, noteLength + tail, 0.025, tail) * decay;
    }
    return sum * 0.65;
  } };
}

function boom(name) {
  const variant = Number(name.at(-1));
  const duration = 0.52 + 0.08 * variant;
  return { duration, sample(t, noise) {
    const base = (105 + variant * 17) * Math.exp(-5.2 * t) + 40;
    const thump = sine(base * t + 2 * Math.exp(-15 * t)) * Math.exp(-6.4 * t);
    const crack = noise() * Math.exp(-29 * t);
    const rumble = sine((34 + variant * 3) * t) * Math.exp(-4.5 * t);
    return (0.68 * thump + 0.28 * crack + 0.21 * rumble) * envelope(t, duration, 0.003, 0.08);
  } };
}


// Round 2: heartbeat and the deliberately silly "annoying power-play" pool.
const tri = (phase) => 4 * Math.abs(phase - Math.floor(phase + 0.5)) - 1;
const square = (phase) => (phase - Math.floor(phase) < 0.5 ? 1 : -1);
// Phase accumulator for a time-varying frequency (closed form is awkward for sweeps).
function sweep(f0, f1, duration) {
  return (t) => f0 * t + (f1 - f0) * t * t / (2 * duration);
}

function annoyPatch(n) {
  switch (n) {
    case 1: return { duration: 1.5, sample(t) { // air horn: three stacked square-ish tones
      const wob = 1 + 0.004 * sine(6 * t);
      return (square(415 * wob * t) + square(523 * wob * t) * 0.8 + square(622 * wob * t) * 0.7) * 0.3 * envelope(t, 1.5, 0.02, 0.25);
    } };
    case 2: return { duration: 0.9, sample(t) { // clown honk x2
      const local = t % 0.45;
      return (saw(250 * local - 60 * local * local) * 0.6 + square(125 * local) * 0.3) * envelope(local, 0.4, 0.01, 0.1) * (t < 0.9 ? 1 : 0);
    } };
    case 3: { const notes = [523, 659, 784, 659, 784, 1047]; return { duration: 1.5, sample(t) { // kazoo fanfare
      const i = Math.min(notes.length - 1, Math.floor(t / 0.22));
      const local = t - i * 0.22;
      const f = notes[i] * (1 + 0.012 * sine(26 * t));
      return (saw(f * t) * 0.5 + square(f * 2 * t) * 0.18) * envelope(local, i === 5 ? 0.6 : 0.2, 0.01, 0.04) * (t < 0.22 * 5 + 0.7 ? 1 : 0);
    } }; }
    case 4: { const up = sweep(300, 1900, 0.7); const top = up(0.7); return { duration: 1.1, sample(t) { // slide whistle: swoop up, wobble down
      const phase = t < 0.7 ? up(t) : top + 1900 * (t - 0.7) - 2300 * (t - 0.7) ** 2 / (2 * 0.4);
      return sine(phase) * 0.5 * envelope(t, 1.1, 0.03, 0.12);
    } }; }
    case 5: return { duration: 1.0, sample(t, noise) { // duck quacks
      const local = t % 0.34;
      if (t > 0.9) return 0;
      const f = 480 - 140 * local / 0.34;
      return (saw(f * local) * 0.55 + noise() * 0.12) * (0.6 + 0.4 * sine(70 * local)) * envelope(local, 0.26, 0.012, 0.06);
    } };
    case 6: return { duration: 0.9, sample(t, noise) { // rubber chicken squawk
      const f = 300 + 700 * Math.exp(-4 * t) + 90 * sine(20 * t);
      return (saw(f * t) * 0.5 + noise() * 0.22 * Math.exp(-3 * t)) * envelope(t, 0.9, 0.01, 0.2);
    } };
    case 7: return { duration: 1.6, sample(t) { // siren whoop
      const f = 700 + 500 * sine(1.7 * t);
      const phase = 700 * t - (500 / (tau * 1.7)) * Math.cos(tau * 1.7 * t);
      void f;
      return (sine(phase) * 0.55 + sine(2 * phase) * 0.2) * envelope(t, 1.6, 0.05, 0.2);
    } };
    case 8: return { duration: 1.5, sample(t, noise) { // vuvuzela blast
      return (saw(233 * t) * 0.5 + saw(466.4 * t) * 0.25 + noise() * 0.1) * (0.85 + 0.15 * sine(28 * t)) * envelope(t, 1.5, 0.05, 0.25);
    } };
    case 9: return { duration: 1.2, sample(t) { // boing-boing
      const local = t % 0.6;
      const f = 140 + 520 * Math.exp(-5 * local) + 40 * sine(34 * local);
      return (sine(f * local) * 0.6 + sine(2.01 * f * local) * 0.2) * Math.exp(-3.2 * local) * envelope(local, 0.6, 0.004, 0.05);
    } };
    case 10: { const notes = [784, 659, 784, 659, 523]; const len = [0.18, 0.18, 0.18, 0.18, 0.5]; return { duration: 1.45, sample(t) { // "nyah-nyah" taunt
      let start = 0;
      for (let i = 0; i < 5; i++) {
        if (t < start + len[i] + 0.05 || i === 4) {
          const local = t - start;
          return (square(notes[i] * t) * 0.3 + tri(notes[i] * t) * 0.3) * envelope(local, len[i], 0.01, 0.05) * (local < len[i] ? 1 : 0);
        }
        start += len[i] + 0.05;
      }
      return 0;
    } }; }
    case 11: return { duration: 1.6, sample(t, noise) { // cowbell frenzy
      const local = t % 0.2;
      const ring = (square(562 * local) + square(845 * local)) * 0.26;
      return (ring + noise() * 0.03) * Math.exp(-14 * local) * envelope(t, 1.6, 0.004, 0.12);
    } };
    case 12: return { duration: 1.2, sample(t) { // cuckoo x3: high note then low note
      const local = t % 0.4;
      const f = local < 0.2 ? 880 : 698;
      return sine(f * t) * 0.55 * envelope(local % 0.2, 0.16, 0.01, 0.04) * (local % 0.2 < 0.16 ? 1 : 0);
    } };
    case 13: return { duration: 1.7, sample(t, noise) { // drum roll + crash
      if (t < 1.1) {
        const roll = noise() * (0.35 + 0.35 * t) * (0.7 + 0.3 * sine(30 * t)) * 0.9;
        return roll * envelope(t, 1.1, 0.01, 0.01);
      }
      const local = t - 1.1;
      return (noise() * 0.6 + sine(300 * local) * 0.2) * Math.exp(-5 * local) * envelope(local, 0.6, 0.002, 0.1);
    } };
    default: throw new Error(`No annoying patch ${n}`);
  }
}

function ownPatch(name) {
  if (name.startsWith('power-annoy-')) return annoyPatch(Number(name.slice(12)));
  if (name === 'heartbeat') return { duration: 0.62, sample(t) { // two soft thumps, lub-dub
    const thump = (local, f) => sine(f * local) * Math.exp(-22 * local) * Math.min(1, local * 400);
    return 0.9 * thump(t, 58) + (t >= 0.2 ? 0.7 * thump(t - 0.2, 70) : 0);
  } };
  if (name.startsWith('burst-boom-')) return boom(name);
  if (name === 'word-invalid') return { duration: 0.68, sample(t) {
    const index = t < 0.33 ? 0 : 1;
    const local = t - index * 0.33;
    const frequency = (index ? 185 : 265) - 92 * local + 8 * sine(7 * local);
    return (0.52 * saw(frequency * local) + 0.3 * sine(frequency * local)) * envelope(local, 0.32, 0.016, 0.12);
  } };
  if (name === 'rumble-fanfare') return melody([392, 523.25, 659.25, 783.99, 1046.5], 0.18, 0.24);
  if (name === 'game-over-fanfare') return melody([392, 493.88, 587.33, 783.99, 783.99, 1046.5], 0.2, 0.3);
  if (name === 'defeat-trombone') return { duration: 1.72, sample(t) {
    const notes = [349.23, 311.13, 277.18, 196];
    const step = 0.42;
    const index = Math.min(3, Math.floor(t / step));
    const local = t - index * step;
    const slide = notes[index] * (1 - 0.13 * Math.min(1, local / step));
    return 0.68 * (0.72 * saw(slide * local) + 0.28 * sine(slide * local)) * envelope(local, step, 0.04, 0.11);
  } };
  if (name === 'buzzer') return { duration: 0.82, sample(t, noise) {
    const buzz = 0.55 * saw(155 * t) + 0.25 * saw(162 * t) + 0.08 * noise();
    return buzz * (0.75 + 0.25 * sine(16 * t)) * envelope(t, 0.82, 0.006, 0.11);
  } };
  if (name === 'high-score-ding') return { duration: 1.2, sample(t) {
    const ring = sine(880 * t) + 0.43 * sine(1320 * t) + 0.27 * sine(1760 * t);
    return ring * 0.54 * Math.exp(-3.2 * t) * envelope(t, 1.2, 0.003, 0.16);
  } };
  throw new Error(`No original patch for ${name}`);
}

function fallbackPatch(name) {
  if (name.startsWith('burst-pow') || name.startsWith('burst-crash')) return boom(`burst-boom-${Number(name.at(-1)) % 3 + 1}`);
  if (name.startsWith('burst-zap') || name.startsWith('burst-whoosh')) return { duration: 0.38, sample(t, noise) {
    const pitch = (name.includes('zap') ? 1150 : 650) * Math.exp(-6 * t) + 120;
    return (0.64 * sine(pitch * t) + 0.22 * noise()) * Math.exp(-8 * t) * envelope(t, 0.38, 0.006, 0.08);
  } };
  if (/bag|shuffle|dice|page|scribble|wheel-spin|recall|exchange/.test(name)) return { duration: 0.45, sample(t, noise) {
    const pulses = Math.abs(sine((name.includes('wheel') ? 21 : 13) * t));
    return (0.43 * noise() + 0.18 * sine(125 * t)) * pulses * envelope(t, 0.45, 0.015, 0.12);
  } };
  if (/tile|rack|wheel-land|flip/.test(name)) return { duration: 0.22, sample(t, noise) {
    return (0.49 * noise() + 0.34 * sine(210 * t) + 0.13 * sine(440 * t)) * Math.exp(-25 * t) * envelope(t, 0.22, 0.003, 0.055);
  } };
  if (name === 'word-valid' || name === 'first-draw-reveal' || name === 'hint-ghost') return melody([523.25, 783.99], 0.15, 0.11);
  return { duration: 0.19, sample(t) {
    const rising = /hover|resume|toggle/.test(name);
    const pitch = rising ? 480 + 620 * t : 750 - 480 * t;
    return 0.48 * sine(pitch * t) * envelope(t, 0.19, 0.008, 0.07);
  } };
}

await mkdir(sounds, { recursive: true });
for (const name of OWN_SOUNDS) {
  const path = join(sounds, `${name}.wav`);
  if (existsSync(path)) continue;
  const { duration, sample } = ownPatch(name);
  await writeFile(path, wav(name, duration, sample));
  console.log(`Synthesized: ${name}`);
}
for (const name of Object.keys(SOUND_SOURCES)) {
  if (existsSync(join(sounds, `${name}.ogg`)) || existsSync(join(sounds, `${name}.wav`))) continue;
  const { duration, sample } = fallbackPatch(name);
  await writeFile(join(sounds, `${name}.wav`), wav(name, duration, sample));
  console.log(`Synthesized fallback: ${name}`);
}
