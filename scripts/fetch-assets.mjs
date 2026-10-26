import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, inflateRawSync } from 'node:zlib';
import { PACKS, OWN_SOUNDS, SOUND_SOURCES } from './sound-map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = join(root, 'resources');
const sounds = join(resources, 'sounds');
const cache = join(root, '.cache');

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function writeNew(path, bytes) {
  if (existsSync(path)) return false;
  await mkdir(dirname(path), { recursive: true });
  // A failed download or interrupted write must not look like a completed asset.
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, bytes);
  try {
    const { rename } = await import('node:fs/promises');
    await rename(temp, path);
  } catch (error) {
    const { rm } = await import('node:fs/promises');
    await rm(temp, { force: true });
    throw error;
  }
  return true;
}

async function fetchWords() {
  const wordPath = join(resources, 'words', 'enable.txt.gz');
  if (!existsSync(wordPath)) {
    const raw = (await download('https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt')).toString('utf8');
    const words = raw.split(/\r?\n/).map((word) => word.trim().toLowerCase()).filter(Boolean);
    if (words.length !== 172823 || !['qat', 'zax', 'cwm'].every((word) => words.includes(word))) {
      throw new Error(`Unexpected ENABLE download: ${words.length} words`);
    }
    await writeNew(wordPath, gzipSync(`${words.join('\n')}\n`, { level: 9, mtime: 0 }));
    console.log(`ENABLE: ${words.length} words`);
  } else console.log('ENABLE: already present');

  // These post-ENABLE two-letter entries are absent from ENABLE and appear in
  // Collins' official list: https://scrabble.collinsdictionary.com/word-lists/two-letter-words-in-scrabble/
  // This is a small supplement, not a full tournament lexicon.
  const extras = ['da', 'ee', 'ew', 'fe', 'gi', 'ki', 'ok', 'oo', 'po', 'qi', 'te', 'za', 'ze', 'zo'];
  const extraPath = join(resources, 'words', 'extras.txt');
  if (await writeNew(extraPath, `${extras.join('\n')}\n`)) console.log(`Extras: ${extras.length} words`);
}

async function fetchFonts() {
  const base = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
  const files = [
    ['Bangers-Regular.ttf', `${base}/bangers/Bangers-Regular.ttf`],
    ['Bangers-OFL.txt', `${base}/bangers/OFL.txt`],
    ['Fredoka-Variable.ttf', `${base}/fredoka/Fredoka%5Bwdth%2Cwght%5D.ttf`],
    ['Fredoka-OFL.txt', `${base}/fredoka/OFL.txt`],
  ];
  for (const [name, url] of files) {
    const path = join(resources, 'fonts', name);
    if (existsSync(path)) continue;
    const bytes = await download(url);
    if (bytes.length < 1000) throw new Error(`Font download too small: ${url}`);
    await writeNew(path, bytes);
    console.log(`Font: ${name}`);
  }
}

// Kenney ZIPs use ordinary stored/deflated entries. Read only the selected
// clips from the central directory; no extracted archive tree or ZIP package.
function zipEntries(zip) {
  let end = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset--) {
    if (zip.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error('ZIP end record missing');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries = new Map();
  for (let index = 0; index < count; index++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
    const method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name.toLowerCase(), { method, size, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function extract(zip, entry) {
  const offset = entry.localOffset;
  if (zip.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP file entry');
  const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
  const data = zip.subarray(start, start + entry.size);
  if (data.length !== entry.size) throw new Error('Truncated ZIP file entry');
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`Unsupported ZIP compression method ${entry.method}`);
}

const loadedPacks = new Map();
async function loadPack(slug) {
  if (!loadedPacks.has(slug)) loadedPacks.set(slug, (async () => {
    const path = join(cache, `${slug}.zip`);
    if (!existsSync(path)) {
      await writeNew(path, await download(PACKS[slug]));
      console.log(`Cached Kenney: ${slug}`);
    }
    const zip = await readFile(path);
    return { zip, entries: zipEntries(zip) };
  })());
  return loadedPacks.get(slug);
}

async function fetchSounds() {
  const used = new Map();
  const missing = [];
  await mkdir(sounds, { recursive: true });
  const creditsPath = join(sounds, 'CREDITS.md');
  const previousCredits = existsSync(creditsPath) ? await readFile(creditsPath, 'utf8') : '';
  for (const [name, choices] of Object.entries(SOUND_SOURCES)) {
    if (existsSync(join(sounds, `${name}.ogg`))) {
      const previous = previousCredits.split('\n').find((line) => line.startsWith(`- \`${name}.ogg\` — `));
      const match = previous?.match(/— ([\w-]+): `([^`]+)`/);
      used.set(name, match ? [match[1], match[2]] : choices[0]);
      continue;
    }
    if (existsSync(join(sounds, `${name}.wav`))) continue;
    let found = false;
    for (const [slug, file] of choices) {
      try {
        const { zip, entries } = await loadPack(slug);
        const entry = entries.get(file.toLowerCase());
        if (!entry) continue;
        const bytes = extract(zip, entry);
        if (!bytes.subarray(0, 4).equals(Buffer.from('OggS'))) throw new Error(`Not Ogg: ${slug}/${file}`);
        await writeNew(join(sounds, `${name}.ogg`), bytes);
        used.set(name, [slug, file]);
        console.log(`Kenney: ${name} <- ${slug}/${file}`);
        found = true;
        break;
      } catch (error) {
        console.warn(`Kenney ${slug} unavailable for ${name}: ${error.message}`);
      }
    }
    if (!found) missing.push(name);
  }

  const credits = [
    '# Sound credits', '',
    'Kenney audio: Creative Commons CC0 (public domain). Attribution is optional; thank you, Kenney.',
    'Pack pages and the ZIP URLs used by the fetch script:', '',
    ...Object.entries(PACKS).map(([slug, url]) => `- [${slug}](https://kenney.nl/assets/${slug}) — ${url}`),
    '', 'Voiceover Pack performers (from the pack Credits.txt): male voice Jeffrey M. Smith (http://fiverr.com/jeffreymsmith), female voice Giselle (http://fiverr.com/easymedia).',
    'Music Jingles (8-bit, hit, pizzicato, sax, steel) are also Kenney CC0.',
    '', 'Selected Kenney clips:', '',
    ...[...used].map(([name, [slug, file]]) => `- \`${name}.ogg\` — ${slug}: \`${file}\``),
    '',
    'The `.wav` effects generated by `scripts/render-sounds.mjs` are original synthesized sounds made for Word Rumble:',
    `${OWN_SOUNDS.map((name) => `\`${name}\``).join(', ')}.`,
    'If a Kenney clip cannot be fetched, that script also synthesizes a fallback WAV for its missing name.',
    '',
  ].join('\n');
  if (!existsSync(creditsPath) || (await readFile(creditsPath, 'utf8')) !== credits) await writeFile(creditsPath, credits);
  if (missing.length) console.warn(`Run assets:sounds for fallbacks: ${missing.join(', ')}`);
  else console.log(`Kenney sounds: ${used.size}/${Object.keys(SOUND_SOURCES).length}`);
}

await fetchWords();
await fetchFonts();
await fetchSounds();
