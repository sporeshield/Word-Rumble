// Peak and integrated loudness (ITU-R BS.1770 K-weighting, 400 ms blocks, -70 LUFS absolute gate
// and -10 LU relative gate) of a mono PCM WAV (16 or 24 bit). Used to check renders.
import { readFileSync } from 'node:fs'

export const readWav = (file) => {
  const b = readFileSync(file)
  let o = 12
  let fmt
  while (o < b.length) {
    const id = b.toString('ascii', o, o + 4)
    const size = b.readUInt32LE(o + 4)
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) }
    if (id === 'data') {
      const bytes = fmt.bits / 8
      const n = Math.floor(Math.min(size, b.length - o - 8) / bytes / fmt.channels)
      const all = Array.from({ length: fmt.channels }, () => new Float64Array(n))
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < fmt.channels; c++) {
          const p = o + 8 + (i * fmt.channels + c) * bytes
          all[c][i] = fmt.bits === 24 ? b.readIntLE(p, 3) / 8388608 : b.readInt16LE(p) / 32768
        }
      }
      return { ...fmt, samples: all[0], all }
    }
    o += 8 + size + (size & 1)
  }
  throw new Error(`No data chunk in ${file}`)
}

const biquad = (x, [b0, b1, b2, a1, a2]) => {
  const y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    y[i] = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y[i]
  }
  return y
}

// K-weighting coefficients derived for any sample rate (shelf + high-pass, per BS.1770 / libebur128).
const kWeighting = (rate) => {
  const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196
  let K = Math.tan((Math.PI * f0) / rate)
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416)
  let a0 = 1 + K / Q + K * K
  const shelf = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]
  const f1 = 38.13547087602444, Q2 = 0.5003270373238773
  K = Math.tan((Math.PI * f1) / rate)
  a0 = 1 + K / Q2 + K * K
  const high = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0]
  return [shelf, high]
}

export const analyze = (file) => {
  const { samples, all, rate } = readWav(file)
  let peak = 0
  for (const ch of all) for (const s of ch) peak = Math.max(peak, Math.abs(s))
  const [shelf, high] = kWeighting(rate)
  const ks = all.map((ch) => biquad(biquad(ch, shelf), high)) // channel energies add up (BS.1770)
  const length = ks[0].length
  const block = Math.round(0.4 * rate), step = Math.round(0.1 * rate)
  const energies = []
  for (let s = 0; s + block <= length; s += step) {
    let sum = 0
    for (const k of ks) for (let i = s; i < s + block; i++) sum += k[i] * k[i]
    energies.push(sum / block)
  }
  if (!energies.length) { // shorter than one block: measure the whole file
    let sum = 0
    for (const k of ks) for (const v of k) sum += v * v
    energies.push(sum / Math.max(1, length))
  }
  const lufs = (e) => -0.691 + 10 * Math.log10(e)
  const kept = energies.filter((e) => lufs(e) > -70)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
  let integrated = -Infinity
  if (kept.length) {
    const rel = lufs(mean(kept)) - 10
    const gated = kept.filter((e) => lufs(e) > rel)
    integrated = lufs(mean(gated.length ? gated : kept))
  }
  return { seconds: samples.length / rate, peakDb: peak ? 20 * Math.log10(peak) : -Infinity, lufs: integrated }
}
