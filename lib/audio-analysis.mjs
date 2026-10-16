// audio-analysis.mjs: tempo, first downbeat and loudness sections of a song, in plain JS (ffmpeg decodes).
//   analyzeAudio(path) → { duration, bpm, offset, confidence, sections: [{ t0, t1, energy }] }
// Method: onset-strength envelope (positive band-energy flux, 4 bands, 100 Hz) → autocorrelation over 60–180 BPM with a
// mild preference for 80–130 → beat phase that maximises onset energy on the grid → offset = first beat ≥ 0.
import { spawnSync } from 'node:child_process';

const SR = 11025, HOP = 110, WIN = 1024;              // ~100 envelope frames per second

export function decodeMono(path, sr = SR) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status) throw new Error(`ffmpeg could not decode ${path}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
}

// radix-2 FFT magnitude (in place on re/im)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) { const k = i + j, l = k + len / 2, tr = re[l] * cr - im[l] * ci, ti = re[l] * ci + im[l] * cr;
        re[l] = re[k] - tr; im[l] = im[k] - ti; re[k] += tr; im[k] += ti; const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr; } }
  }
}
// onset envelopes: Hann-windowed 1024-point spectra every 10 ms, positive log-magnitude flux, summed over all bins (full)
// and over bins < ~160 Hz (low: the kick), each minus a 1 s centred moving mean and clipped at 0. Returns { full, low, fps }.
export function onsetEnvelopes(x) {
  const n = Math.floor((x.length - WIN) / HOP), nb = WIN / 2 + 1, LOWB = 15;
  const hann = new Float32Array(WIN).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (WIN - 1)));
  const re = new Float64Array(WIN), im = new Float64Array(WIN); let prev = new Float64Array(nb), cur = new Float64Array(nb);
  const full = new Float32Array(n), low = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    const s = f * HOP; for (let i = 0; i < WIN; i++) { re[i] = x[s + i] * hann[i]; im[i] = 0; }
    fft(re, im);
    let a = 0, b = 0;
    for (let k = 0; k < nb; k++) { cur[k] = Math.log1p(100 * Math.hypot(re[k], im[k])); if (f) { const d = Math.max(0, cur[k] - prev[k]); a += d; if (k < LOWB) b += d; } }
    full[f] = a; low[f] = b; [prev, cur] = [cur, prev];
  }
  const demean = e => { const o = new Float32Array(n), w = 50, pre = new Float64Array(n + 1); for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + e[i];
    for (let i = 0; i < n; i++) { const lo = Math.max(0, i - w), hi = Math.min(n, i + w); o[i] = Math.max(0, e[i] - (pre[hi] - pre[lo]) / (hi - lo)); } return o; };
  return { full: demean(full), low: demean(low), fps: SR / HOP };
}
// how much stronger onsets are ON a beat grid than halfway between beats, at the best phase
export function gridContrast(env, fps, bpm, duration) {
  const beat = 60 / bpm, at = t => env[Math.round(t * fps)] || 0;
  let mean = 0; for (let i = 0; i < env.length; i++) mean += env[i]; mean /= env.length;
  const eps = .05 * mean + 1e-9;                     // floor: a near-silent off-beat must not blow the ratio up
  let best = { c: 0, ph: 0 };
  for (let ph = 0; ph < beat; ph += .005) {
    let on = 0, off = 0, m = 0;
    for (let t = ph; t < duration - beat; t += beat) { on += at(t); off += at(t + beat / 2); m++; }
    const c = (on / m + eps) / (off / m + eps); if (c > best.c) best = { c, ph };
  }
  return best;
}

export function analyzeAudio(path) {
  const x = decodeMono(path), duration = x.length / SR;
  const { full, low, fps } = onsetEnvelopes(x), n = full.length;
  // Scan 60–200 BPM by on/off-beat contrast (autocorrelation alone confuses metrical levels: on pdoom.mp3 it peaks at
  // 66/132 while the beat is 88), on the kick band when it carries a beat, then refine the best ±1 BPM in 0.1 steps.
  const kickC = gridContrast(low, fps, 120, duration).c, scan = b => gridContrast(low, fps, b, duration).c;
  let env = low, coarse = []; for (let b = 60; b <= 200; b += 1) coarse.push([b, scan(b)]);
  if (Math.max(...coarse.map(c => c[1])) < 4) { env = full; coarse = coarse.map(([b]) => [b, gridContrast(full, fps, b, duration).c]); }
  const prior = b => b >= 70 && b <= 140 ? 1 : .8;                    // tie-break toward the usual felt tempo range
  coarse.sort((a, b) => b[1] * prior(b[0]) - a[1] * prior(a[0]));
  const scored = coarse.slice(0, 5).map(([b0]) => {
    let best = { bpm: b0, ...gridContrast(env, fps, b0, duration) };
    for (let b = b0 - 1; b <= b0 + 1; b += .1) { const g = gridContrast(env, fps, b, duration); if (g.c > best.c) best = { bpm: b, ...g }; }
    return { bpm: +best.bpm.toFixed(1), contrast: +best.c.toFixed(2), phase: +best.ph.toFixed(3), score: +(best.c * prior(best.bpm)).toFixed(2) };
  }).sort((a, b) => b.score - a.score);
  const kickStrong = env === low;
  const top = scored[0], beat = 60 / top.bpm;
  // loudness sections: RMS in 1 s windows, split where it jumps by > 6 dB
  const rms = []; for (let i = 0; i + SR <= x.length; i += SR) { let e = 0; for (let j = i; j < i + SR; j++) e += x[j] * x[j]; rms.push(10 * Math.log10(e / SR + 1e-9)); }
  const sections = []; let s0 = 0;
  for (let i = 2; i < rms.length - 1; i++) {
    const before = (rms[i - 1] + rms[i - 2]) / 2, after = (rms[i] + rms[i + 1]) / 2;
    if (Math.abs(after - before) > 6 && i - s0 >= 2) { sections.push({ t0: s0, t1: i, energy_db: +(rms.slice(s0, i).reduce((a, b) => a + b, 0) / (i - s0)).toFixed(1) }); s0 = i; }
  }
  sections.push({ t0: s0, t1: +duration.toFixed(2), energy_db: +(rms.slice(s0).reduce((a, b) => a + b, 0) / Math.max(1, rms.length - s0)).toFixed(1) });
  const confidence = top.contrast >= 8 ? 'high' : top.contrast >= 4 ? 'medium' : 'low';      // low: set bpm/offset by hand
  return { duration: +duration.toFixed(3), bpm: top.bpm, beat: +beat.toFixed(4), offset: top.phase, contrast: top.contrast, confidence,
    band: kickStrong ? 'kick' : 'full', candidates: scored.slice(0, 5), sections };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(analyzeAudio(process.argv[2]), null, 1));
