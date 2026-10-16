// ingest.mjs: turn an input file into a brief the storyboard step can use. No models: only parsing and measurement.
//   ingest(file, projectDir) → brief object, also written to <projectDir>/input/brief.json and brief.md
// Kinds (by extension / content):
//   lyrics  .lrc, or .txt/.md whose lines start with timestamps (1:23.4 / [01:23.45])  → timed lines, karaoke-ready
//   script  .txt/.md without timestamps                                                 → beats with estimated read times
//   image   .png .jpg .jpeg .webp .gif .bmp                                             → size, palette, thumbnail
//   audio   .mp3 .wav .m4a .flac .ogg .aac                                              → duration, bpm, first beat, sections
//   video   .mp4 .mov .webm .mkv .m4v                                                   → duration, cuts, keyframe sheet, audio analysis
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import { analyzeAudio } from './audio-analysis.mjs';

const EXT = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'], audio: ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'],
  video: ['.mp4', '.mov', '.webm', '.mkv', '.m4v'], text: ['.lrc', '.txt', '.md', '.srt'],
};
const TS = /^\s*\[?(\d{1,2}):(\d{2}(?:\.\d+)?)\]?\s*/;
export function kindOf(file) {
  const e = extname(file).toLowerCase();
  for (const [k, list] of Object.entries(EXT)) if (list.includes(e)) {
    if (k !== 'text') return k;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim());
    if (e === '.srt') return 'lyrics';
    return lines.filter(l => TS.test(l)).length >= Math.max(2, lines.length * .5) ? 'lyrics' : 'script';
  }
  throw new Error(`unsupported input type: ${file}`);
}
const ff = (args, max = 1 << 28) => { const r = spawnSync('ffmpeg', ['-v', 'error', ...args], { maxBuffer: max }); if (r.status) throw new Error(String(r.stderr)); return r.stdout; };
const probe = f => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', f]).stdout);

// ---------- text ----------
export function parseLyrics(src) {
  const out = [];
  if (/-->/.test(src)) {                         // SRT
    for (const block of src.split(/\r?\n\r?\n/)) {
      const m = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/.exec(block); if (!m) continue;
      const t = i => +m[i] * 3600 + +m[i + 1] * 60 + +m[i + 2] + +m[i + 3] / 1000;
      const text = block.split(/\r?\n/).slice(2).join(' ').trim(); if (text) out.push([t(1), t(5), text]);
    }
    return out;
  }
  const rows = [];
  for (const line of src.split(/\r?\n/)) {
    let rest = line, times = [], m;
    while ((m = TS.exec(rest))) { times.push(+m[1] * 60 + +m[2]); rest = rest.slice(m[0].length); }
    if (/^\s*\[(ar|ti|al|by|offset):/i.test(line)) continue;
    for (const t of times) rows.push([t, rest.trim()]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  rows.forEach(([t, text], i) => { if (!text) return; const next = rows[i + 1] ? rows[i + 1][0] : t + 4; out.push([+t.toFixed(2), +Math.min(next, t + 6).toFixed(2), text]); });
  return out;
}
// Read-time estimate for a story beat: the viewer needs time to find, understand and register it (guide rule 4).
const cjk = s => (s.match(/[㐀-鿿豈-﫿]/g) || []).length;
export function readTime(text) { const words = text.replace(/[㐀-鿿豈-﫿]/g, ' ').split(/\s+/).filter(Boolean).length; return +Math.min(4, Math.max(1.4, 1.0 + .28 * words + .12 * cjk(text))).toFixed(2); }
export function parseScript(src) {
  const beats = src.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^#/.test(l))
    .flatMap(l => l.split(/(?<=[.!?。！？])\s*/)).map(s => s.trim()).filter(Boolean);
  let t = .5; return beats.map(text => { const d = readTime(text), b = { t0: +t.toFixed(2), t1: +(t + d).toFixed(2), text }; t += d; return b; });
}

// ---------- image ----------
export function imagePalette(file, k = 6) {
  const W = 96, buf = ff(['-i', file, '-frames:v', '1', '-vf', `scale=${W}:-2`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const px = []; for (let i = 0; i + 2 < buf.length; i += 3) px.push([buf[i], buf[i + 1], buf[i + 2]]);
  // deterministic k-means: seeds spread along luminance order
  const lum = p => .299 * p[0] + .587 * p[1] + .114 * p[2], sorted = [...px].sort((a, b) => lum(a) - lum(b));
  let C = Array.from({ length: k }, (_, i) => [...sorted[Math.floor((i + .5) / k * sorted.length)]]);
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 12; it++) {
    assign = px.map(p => { let bi = 0, bd = Infinity; C.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = j; } }); return bi; });
    C = C.map((c, j) => { const m = px.filter((_, i) => assign[i] === j); return m.length ? [0, 1, 2].map(d => m.reduce((s, p) => s + p[d], 0) / m.length) : c; });
  }
  const counts = C.map((_, j) => assign.filter(a => a === j).length);
  return C.map((c, j) => ({ hex: '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), share: +(counts[j] / px.length).toFixed(3) })).sort((a, b) => b.share - a.share);
}

// ---------- video ----------
export function videoCuts(file, thr = .3) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-an', '-vf', `scale=320:-2,select='gt(scene,${thr})',metadata=print`, '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  return [...String(r.stderr).matchAll(/pts_time:([\d.]+)/g)].map(m => +(+m[1]).toFixed(2));
}

export function ingest(file, pdir) {
  const kind = kindOf(file), idir = join(pdir, 'input'), adir = join(pdir, 'assets'); mkdirSync(idir, { recursive: true }); mkdirSync(adir, { recursive: true });
  const name = basename(file), brief = { kind, source: name };
  if (!existsSync(join(idir, name))) copyFileSync(file, join(idir, name));
  if (kind === 'lyrics') { brief.lines = parseLyrics(readFileSync(file, 'utf8')); brief.duration = brief.lines.length ? +(brief.lines.at(-1)[1] + 1.5).toFixed(2) : 10; }
  if (kind === 'script') { brief.beats = parseScript(readFileSync(file, 'utf8')); brief.duration = brief.beats.length ? +(brief.beats.at(-1).t1 + 1).toFixed(2) : 10; }
  if (kind === 'image') {
    const s = probe(file).streams[0]; brief.size = `${s.width}x${s.height}`; brief.palette = imagePalette(file);
    ff(['-y', '-i', file, '-frames:v', '1', '-vf', 'scale=640:-2', join(idir, 'reference.jpg')]); brief.reference = 'input/reference.jpg';
  }
  if (kind === 'audio' || kind === 'video') {
    const p = probe(file); brief.duration = +(+p.format.duration).toFixed(2);
    const hasAudio = p.streams.some(s => s.codec_type === 'audio');
    if (hasAudio) {
      const wav = join(adir, 'audio.wav'); ff(['-y', '-i', file, '-vn', '-ac', '2', '-ar', '48000', wav]); brief.audio = `projects/${basename(pdir)}/assets/audio.wav`;
      brief.music = analyzeAudio(wav);
    }
    if (kind === 'video') {
      const v = p.streams.find(s => s.codec_type === 'video'); brief.size = `${v.width}x${v.height}`; brief.cuts = videoCuts(file);
      const bounds = [0, ...brief.cuts, brief.duration]; brief.shots = bounds.slice(1).map((b, i) => ({ t0: bounds[i], t1: b, len: +(b - bounds[i]).toFixed(2) }));
      const mids = brief.shots.slice(0, 48).map(s => (s.t0 + s.t1) / 2), kf = join(idir, 'keyframes'); mkdirSync(kf, { recursive: true });
      mids.forEach((m, i) => ff(['-y', '-ss', m.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=320:-2', join(kf, `k${String(i + 1).padStart(2, '0')}.jpg`)]));
      ff(['-y', '-framerate', '1', '-i', join(kf, 'k%02d.jpg'), '-vf', `tile=6x${Math.ceil(mids.length / 6)}`, '-frames:v', '1', join(idir, 'shots.jpg')]);
      brief.shot_sheet = 'input/shots.jpg';
    }
  }
  // one brief per input (brief-<file>.json/md); brief.json/brief.md merge all of them, so a song + its lyrics both count
  const stem = name.replace(/[^\w.-]+/g, '_');
  writeFileSync(join(idir, `brief-${stem}.json`), JSON.stringify(brief, null, 1));
  writeFileSync(join(idir, `brief-${stem}.md`), briefMd(brief));
  const all = readdirSync(idir).filter(f => /^brief-.*\.json$/.test(f)).sort().map(f => JSON.parse(readFileSync(join(idir, f), 'utf8')));
  const merged = Object.assign({}, ...all, { inputs: all.map(b => `${b.source} (${b.kind})`) });
  writeFileSync(join(idir, 'brief.json'), JSON.stringify(merged, null, 1));
  writeFileSync(join(idir, 'brief.md'), all.map(briefMd).join('\n---\n\n'));
  return merged;
}

function briefMd(b) {
  const L = [`# Input brief: ${b.source} (${b.kind})`, '', 'Measured by `c2v ingest` (parsing and signal analysis only, no models). Use it to write STORYBOARD.md.', ''];
  if (b.duration) L.push(`- duration: ${b.duration} s`);
  if (b.size) L.push(`- size: ${b.size}`);
  if (b.music) L.push(`- music: ${b.music.bpm} BPM (beat ${b.music.beat} s), first beat at ${b.music.offset} s, confidence ${b.music.confidence} (contrast ${b.music.contrast}, ${b.music.band} band)` +
    (b.music.confidence === 'low' ? ' — **set bpm/offset by hand**' : '') + (b.duration < 30 ? ' — short excerpt: the tempo is reliable, the first-beat phase can lock to a syncopated subdivision; check it on a strip, or analyse the full song' : ''), `- loudness sections: ${b.music.sections.map(s => `${s.t0}–${s.t1} s (${s.energy_db} dB)`).join(', ')}`);
  if (b.palette) L.push(`- palette: ${b.palette.map(p => `${p.hex} (${Math.round(p.share * 100)}%)`).join(', ')}`, `- reference: ${b.reference}`);
  if (b.lines) { L.push('', '## Timed lines', '', '| t0 | t1 | line |', '|---|---|---|'); for (const [a, c, t] of b.lines) L.push(`| ${a} | ${c} | ${t} |`); }
  if (b.beats) { L.push('', '## Story beats (estimated read time 1.4–4 s each)', '', '| t0 | t1 | beat |', '|---|---|---|'); for (const x of b.beats) L.push(`| ${x.t0} | ${x.t1} | ${x.text} |`); }
  if (b.shots) { L.push('', `## Source shots (${b.shots.length}, scene threshold .3)`, '', `keyframes: ${b.shot_sheet}`, '', '| # | t0 | t1 | len |', '|---|---|---|---|'); b.shots.forEach((s, i) => L.push(`| ${i + 1} | ${s.t0} | ${s.t1} | ${s.len} |`)); }
  return L.join('\n') + '\n';
}
