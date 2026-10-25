import { shuffle } from '../engine/bag'

export type BurstTier = 'dl' | 'tl' | 'dw' | 'tw' | 'top' | 'fibber' | 'hint' | 'timeout'

/** Comic-burst word pools. Every word is unique across all tiers. */
export const BURST_POOLS: Record<BurstTier, readonly string[]> = {
  dl: ['ZING!', 'POP!', 'BOINK!', 'PING!', 'ZIP!', 'TWANG!', 'BLIP!', 'TING!', 'PLINK!', 'BEEP!', 'SNAP!', 'DING!',
    'TICK!', 'BOP!', 'ZIPPY!', 'PLONK!', 'TWEAK!', 'SPROING!', 'BLOOP!', 'FLICK!', 'WHIZ!', 'ZAPLET!'],
  tl: ['ZAP!', 'KRAK!', 'THWIP!', 'SPLAT!', 'ZOWIE!', 'CRACKLE!', 'SIZZLE!', 'WHAP!', 'KLANG!', 'BAZINGA!', 'SPLOOSH!',
    'ZOINKS!', 'FWOOSH!', 'CRUNCH!', 'KAZAM!', 'YOWZA!', 'SKRONK!', 'WHIZZO!', 'ZINGO!', 'BLAZE!'],
  dw: ['BOOM!', 'KAPOW!', 'WHAM!', 'BLAMMO!', 'THWACK!', 'BAM!', 'SMASH!', 'KERPOW!', 'WALLOP!', 'BIFF!', 'CLOBBER!',
    'SOCK!', 'THUD!', 'BONK!', 'KABAM!', 'POW!', 'SLAM!', 'WHOMP!', 'KERSPLAT!', 'BANG!', 'CRASH!', 'THUMP!', 'KLONK!', 'ZONK!'],
  tw: ['KABLOW!', 'KA-BOOM!', 'MEGA-WHAM!', 'KERRRANG!', 'SHAZAM-BLAM!', 'KABLAMMO!', 'THUNDERCLAP!', 'WORDQUAKE!',
    'BLASTOFF!', 'KERBLOOEY!', 'SUPERNOVA!', 'BIG-BADA-BOOM!', 'TRIPLE-WHAMMY!', 'KRAKATOA!', 'SKY-BLAM!', 'MEGABLAST!',
    'KA-RUMBLE!', 'TORNADO-POW!'],
  top: ['RUMBLE!!!', 'OUTRAGEOUS!', 'TOTAL KA-CHAOS!', 'WORD WIZARD!', 'UNBELIEVABLE!', 'SPECTACULAR!', 'LEGENDARY!',
    'WORDSPLOSION!', 'JAW-DROPPER!', 'MIND-BLOWN!', 'MONSTER PLAY!', 'HOLY MOLY!', 'ABSOLUTE MAYHEM!', 'GLORIOUS!',
    'EPIC RUMBLE!', 'TILE TSUNAMI!'],
  fibber: ['FIBBER!', 'SAYS WHO?!', 'MADE-UP ALERT!', 'NICE TRY!', 'WORD? REALLY?!', 'SUSPICIOUS!', 'DICTIONARY WEEP!',
    'SOUNDS FAKE!', 'GIBBERISH!', 'CAUGHT YA!', 'FISHY!', 'HMMMM...'],
  hint: ['PSST!', 'WINK WINK!', 'A LITTLE BIRDIE!', 'SECRET TIP!', 'PEEKABOO!', 'BRAIN BOOST!', 'CHEAT SHEET!', 'SNEAKY!'],
  timeout: ['TOO SLOW!', 'TIME\'S UP!', 'BZZZT!', 'SNOOZE LOSE!', 'TICK-TOCKED!', 'OUT OF TIME!', 'HURRY UP!', 'TOO LATE!']
}

/** When a tier runs dry it borrows from the next tier down. */
const FALLBACK: Record<BurstTier, BurstTier | null> = {
  top: 'tw', tw: 'dw', dw: 'tl', tl: 'dl', dl: null,
  fibber: 'dl', hint: 'dl', timeout: 'dl'
}

/** Remaining (still unused) words per tier, in the order they will be shown. JSON-serialisable for autosave. */
export type BurstDecks = Record<BurstTier, string[]>

export interface Burst {
  tier: BurstTier
  text: string
}

export function createBurstDecks(): BurstDecks {
  const tiers = Object.keys(BURST_POOLS) as BurstTier[]
  return Object.fromEntries(tiers.map((t) => [t, shuffle(BURST_POOLS[t])])) as BurstDecks
}

/** Draw the next unused word for a tier (pure). Words never repeat within a deck set. */
export function drawBurst(decks: BurstDecks, tier: BurstTier): { burst: Burst; decks: BurstDecks } {
  let t: BurstTier | null = tier
  while (t && decks[t].length === 0) t = FALLBACK[t]
  // Chain exhausted: borrow from any tier that still has unused words before ever repeating one.
  t ??= (Object.keys(decks) as BurstTier[]).find((k) => decks[k].length > 0) ?? null
  if (!t) {
    // Every word has been shown (more than ~130 bursts in one game): start the tier over.
    const fresh = shuffle(BURST_POOLS[tier])
    return { burst: { tier, text: fresh[0] }, decks: { ...decks, [tier]: fresh.slice(1) } }
  }
  const [text, ...rest] = decks[t]
  return { burst: { tier, text }, decks: { ...decks, [t]: rest } }
}
