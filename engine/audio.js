// audio.js: sound made by code. A score is a list of timed events; renderAudio() synthesises them sample by sample in
// plain JavaScript and returns a 16-bit stereo WAV. Like frames, sound is a pure function of the score: noise comes from
// a seeded generator, filters and the limiter are our own code, so the same score gives byte-identical WAVs on every run
// and machine. (Web Audio's OfflineAudioContext was tried first: its BiquadFilterNode output differs between runs.)
//
//   sound([{ at: 0, kind: 'kick' }, { at: .5, kind: 'tone', note: 'E4', dur: .4, wave: 'triangle' }, ...]);
//   sound(beats(0, 4, 'x...x...x...x...', 'kick'));             // from beat 0, 4 bars, one char per 16th
//   sound(melody(8, ['C4', 'E4', 'G4', '-', 'C5'], .5));         // beat 8 onwards, half-beat steps, '-' = rest
//   render.mjs --synth writes it; --clip / --encode mux it in when the project has a score.
//
// Kinds and their main fields (all optional except at/kind; seconds; gain 0..1; pan -1..1):
//   kick, snare, hat, clap            drums (gain, tone)
//   tone   note|freq, dur, wave (sine/triangle/square/saw), gain, attack, release, glide (to note|freq), vib
//   chord  notes: ['C4','E4','G4'], dur, wave, gain, attack, release, strum
//   pad    notes, dur, gain, attack, release   soft detuned saws, low-passed
//   boom   dur (default 4), gain      low sine drop + long darkening noise: impacts, explosions
//   rumble dur, gain, attack          sustained low noise bed
//   whoosh dur, gain, up (bool)       swept band-passed noise: fast moves, whip pans
//   rain   dur, gain, attack, release, density (drops/s)   hiss bed + seeded droplets
//   splash gain, size (0..1)           a body landing in water
//   pop, chime, click, thud           small foley marks for props and emotes

const SCORE = [];
function sound(list) { SCORE.push(...list.flat().filter(Boolean)); }
const NOTE_I = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function freqOf(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); if (!m) throw new Error('bad note ' + n);
  return 440 * Math.pow(2, (NOTE_I[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (m[3] - 4) * 12) / 12);
}
function beats(fromBeat, bars, pat, kind, o = {}, step = .25) {
  const out = [], n = Math.round(bars * 4 / step);
  for (let i = 0; i < n; i++) { const ch = pat[i % pat.length]; if (ch === 'x' || ch === 'X') out.push({ at: OFF + (fromBeat + i * step) * BEAT, kind, ...o, gain: (o.gain ?? .8) * (ch === 'X' ? 1.25 : 1) }); }
  return out;
}
function melody(fromBeat, notes, step = .5, o = {}) {
  return notes.map((n, i) => n === '-' ? null : { at: OFF + (fromBeat + i * step) * BEAT, kind: 'tone', note: n, dur: step * BEAT * .95, ...o }).filter(Boolean);
}

// ---------- DSP building blocks (all deterministic) ----------
const SR = 48000;
const envAt = (x, a, hold, rel) => x < 0 ? 0 : x < a ? x / a : x < a + hold ? 1 : Math.exp(-6.9 * (x - a - hold) / rel);   // -60 dB at rel
const wave = (type, ph) => {                         // ph in cycles
  const f = ph - Math.floor(ph);
  switch (type) {
    case 'sine': return Math.sin(TAU * f);
    case 'triangle': return 1 - 4 * Math.abs(f - .5);
    case 'square': return Math.tanh(4 * Math.sin(TAU * f));                         // soft square: fewer aliases
    case 'saw': { let s = 0; for (let k = 1; k <= 8; k++) s += Math.sin(TAU * f * k) / k; return s * .55; }   // band-limited-ish
    default: return Math.sin(TAU * f);
  }
};
function onePoleLP() { let y = 0; return (x, fc) => { const a = 1 - Math.exp(-TAU * fc / SR); y += a * (x - y); return y; }; }
function svf() {                                     // Chamberlin state-variable filter: returns { lp, bp, hp }
  let lp = 0, bp = 0;
  return (x, fc, q = 1) => { const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR), hp = x - lp - bp / q; bp += f * hp; lp += f * bp; return { lp, bp, hp }; };
}

// Each voice returns { len (s), fn(i) → [l, r] for sample i since its start } or writes via the helper below.
function voice(e, idx) {
  const g = e.gain, pan = clamp(e.pan ?? 0, -1, 1), rnd = lcg(((idx + 1) * 7919 + Math.round(e.at * 1000)) % 2147483646 + 1), noise = () => rnd() * 2 - 1;
  const mk = (len, f) => ({ len, f, pan });
  switch (e.kind) {
    case 'kick': { const amp = (g ?? .9), t1 = e.tone || 1; let ph = 0;
      return mk(.5, s => { const x = s / SR, fr = 42 + (150 * t1 - 42) * Math.exp(-x / .035); ph += fr / SR; return amp * Math.sin(TAU * ph) * envAt(x, .002, 0, .32); }); }
    case 'thud': return voice({ ...e, kind: 'kick', tone: .6, gain: g ?? .7 }, idx);
    case 'snare': { const amp = g ?? .7, hpf = svf(); let ph = 0;
      return mk(.3, s => { const x = s / SR; ph += 190 / SR; return amp * (.8 * hpf(noise(), 1800 * (e.tone || 1), .7).hp * envAt(x, .001, 0, .16) + .5 * Math.sin(TAU * ph) * envAt(x, .001, 0, .08)); }); }
    case 'clap': { const amp = g ?? .6, hpf = svf();
      return mk(.3, s => { const x = s / SR, burst = [0, .011, .022].reduce((a, o) => a + envAt(x - o, .0005, 0, x - o < .03 ? .02 : .12), 0); return amp * .5 * hpf(noise(), 1400, .9).bp * burst; }); }
    case 'hat': { const amp = g ?? .5, hpf = svf();
      return mk(.1, s => amp * .45 * hpf(noise(), 7000, .7).hp * envAt(s / SR, .001, 0, .045)); }
    case 'tone': { const amp = (g ?? .35) * .6, dur = e.dur ?? .3, a = e.attack ?? .01, rel = e.release ?? .25, f0 = freqOf(e.note ?? e.freq ?? 440), f1 = e.glide ? freqOf(e.glide) : f0; let ph = 0;
      return mk(dur + rel + .05, s => { const x = s / SR, fr = f0 * Math.pow(f1 / f0, clamp(x / dur)) * (1 + (e.vib ? .012 * e.vib * Math.sin(TAU * 5.5 * x) : 0)); ph += fr / SR;
        return amp * wave(e.wave || 'triangle', ph) * envAt(x, a, Math.max(0, dur - a), rel); }); }
    case 'chord': { const ns = e.notes || [], vs = ns.map((n, j) => voice({ ...e, kind: 'tone', note: n, gain: (g ?? .3) / Math.sqrt(ns.length) }, idx * 31 + j));
      const st = Math.round((e.strum || 0) * SR), len = Math.max(...vs.map(v => v.len)) + (e.strum || 0) * ns.length;
      return mk(len, s => vs.reduce((acc, v, j) => { const k = s - j * st; return acc + (k >= 0 && k < v.len * SR ? v.f(k) : 0); }, 0)); }
    case 'pad': { const ns = e.notes || ['C3', 'G3', 'E4'], amp = (g ?? .25) * .5 / Math.sqrt(ns.length), dur = e.dur ?? 3, a = e.attack ?? .8, rel = e.release ?? 1.2, lpf = onePoleLP();
      const ph = ns.flatMap(() => [0, 0]);
      return mk(dur + rel, s => { const x = s / SR; let v = 0;
        ns.forEach((n, j) => [-1, 1].forEach((d, k) => { const fr = freqOf(n) * Math.pow(2, d * 6 / 1200); ph[j * 2 + k] += fr / SR; v += wave('saw', ph[j * 2 + k]); }));
        return amp * lpf(v, 1400) * envAt(x, a, Math.max(0, dur - a), rel); }); }
    case 'boom': { const dur = e.dur ?? 4, amp = g ?? 1, lpf = onePoleLP(), lpf2 = onePoleLP(); let ph = 0;
      return mk(dur, s => { const x = s / SR, fr = 28 + 62 * Math.exp(-x / .35); ph += fr / SR;
        const fc = 120 + 3880 * Math.exp(-x / (dur * .18));
        return amp * (.9 * Math.sin(TAU * ph) * envAt(x, .005, 0, dur * .6) + .8 * lpf2(lpf(noise(), fc), fc) * envAt(x, .01, 0, dur * .9)); }); }
    case 'rumble': { const dur = e.dur ?? 3, amp = (g ?? .6) * 1.6, a = e.attack ?? .4, lpf = onePoleLP(), lpf2 = onePoleLP();
      return mk(dur + .8, s => amp * lpf2(lpf(noise(), 180), 180) * envAt(s / SR, a, Math.max(0, dur - a), .8)); }
    case 'whoosh': { const dur = e.dur ?? .5, amp = (g ?? .5) * .9, bpf = svf(), up = e.up !== false;
      return mk(dur, s => { const x = s / SR, k = x / dur, fc = up ? 300 * Math.pow(10, k) : 3000 * Math.pow(.1, k), env = k < .6 ? k / .6 : (1 - k) / .4;
        return amp * bpf(noise(), fc, 3).bp * env; }); }
    case 'rain': { const dur = e.dur ?? 4, amp = (g ?? .4), a = e.attack ?? .6, rel = e.release ?? .8, hpf = svf(), dpf = svf(), dens = e.density ?? 18;
      const drops = []; for (let k = 0, tt = 0; tt < dur; k++) { tt += (.4 + 1.2 * rnd()) / dens; drops.push([Math.round(tt * SR), .3 + .7 * rnd(), 1500 + 3500 * rnd()]); }
      let di = 0;
      return mk(dur + rel, s => { const x = s / SR, bed = hpf(noise(), 5000, .6).bp * .35;
        let d = 0; while (di < drops.length && drops[di][0] + 400 < s) di++;
        for (let j = di; j < drops.length && drops[j][0] <= s; j++) { const age = (s - drops[j][0]) / SR; if (age < .03) d += drops[j][1] * Math.sin(TAU * drops[j][2] * age) * Math.exp(-age * 180); }
        return amp * (bed + .5 * dpf(d, 3000, 1).bp + .25 * d) * envAt(x, a, Math.max(0, dur - a), rel); }); }
    case 'splash': { const amp = g ?? .7, sz = e.size ?? .6, bpf = svf(), lpf = onePoleLP();
      return mk(.9, s => { const x = s / SR, fc = 2600 * Math.exp(-x / .25) + 300; return amp * (bpf(noise(), fc, 1.2).bp * envAt(x, .004, .02, .35 + .4 * sz) + .5 * lpf(noise(), 220) * envAt(x, .002, 0, .12)); }); }
    case 'pop': return voice({ ...e, kind: 'tone', freq: e.freq || 700, glide: (e.freq || 700) * 1.9, dur: .06, wave: 'sine', release: .06, gain: g ?? .5 }, idx);
    case 'chime': { const vs = [1, 2.76, 5.4].map((m, j) => voice({ ...e, kind: 'tone', freq: freqOf(e.note || 'E6') * m, dur: .02, release: 1.2 / (j + 1), wave: 'sine', gain: (g ?? .3) / (j + 1.5) }, idx * 13 + j));
      return mk(1.3, s => vs.reduce((a, v) => a + (s < v.len * SR ? v.f(s) : 0), 0)); }
    case 'click': { const amp = g ?? .5; return mk(.02, s => amp * noise() * envAt(s / SR, .0005, 0, .012)); }
  }
  return null;
}

function _wav(L, R) {
  const n = L.length, bytes = 44 + n * 4, ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++, o += 4) { v.setInt16(o, Math.round(clamp(L[i], -1, 1) * 32767), true); v.setInt16(o + 2, Math.round(clamp(R[i], -1, 1) * 32767), true); }
  let s = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s);
}
// Render the score: mix every event, then a look-ahead peak limiter (-1 dBFS ceiling) so stacked hits never clip.
window.renderAudio = async (dur = DUR) => {
  const n = Math.ceil(dur * SR), L = new Float32Array(n), R = new Float32Array(n), vol = PROJECT.volume ?? .8;
  SCORE.slice().sort((a, b) => a.at - b.at || (a.kind < b.kind ? -1 : 1)).forEach((e, idx) => {
    const v = voice(e, idx); if (!v) return;
    const s0 = Math.round(e.at * SR), len = Math.ceil(v.len * SR), gl = Math.sqrt((1 - v.pan) / 2) * vol, gr = Math.sqrt((1 + v.pan) / 2) * vol;
    for (let s = 0; s < len && s0 + s < n; s++) { if (s0 + s < 0) { v.f(s); continue; } const x = v.f(s); L[s0 + s] += x * gl; R[s0 + s] += x * gr; }
  });
  const ceil = Math.pow(10, -1 / 20), look = Math.round(.005 * SR), relK = Math.exp(-1 / (.12 * SR));
  const need = new Float32Array(n);                  // gain each sample needs, then the min over the look-ahead window
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); need[i] = p > ceil ? ceil / p : 1; }
  let gain = 1;
  for (let i = 0; i < n; i++) {
    let m = 1; for (let j = i; j < Math.min(n, i + look); j += 8) if (need[j] < m) m = need[j];
    if (need[Math.min(n - 1, i + look - 1)] < m) m = need[Math.min(n - 1, i + look - 1)];
    gain = m < gain ? m : 1 - (1 - gain) * relK;
    L[i] *= gain; R[i] *= gain;
  }
  return { wav: _wav(L, R), events: SCORE.length };
};
