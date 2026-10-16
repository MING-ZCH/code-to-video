// video-metrics.mjs: timing/motion/subtitle metrics for any MP4, in JS (ffmpeg decodes). Same definitions and thresholds
// as scripts/video_metrics.py (which produced docs/baselines.md), so before/after numbers are comparable.
//   node lib/video-metrics.mjs a.mp4 [b.mp4 …]
import { spawnSync } from 'node:child_process';

const W = 160, H = 90, FPS = 12, CUT = 28, STILL = .6;
const run = (args, max = 1 << 30) => { const r = spawnSync('ffmpeg', ['-v', 'error', ...args], { maxBuffer: max }); if (r.status) throw new Error(String(r.stderr)); return r.stdout; };
function probe(path) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', path]);
  const j = JSON.parse(r.stdout), s = j.streams[0], [n, d] = s.r_frame_rate.split('/');
  return { duration: +j.format.duration, fps: n / d, size: `${s.width}x${s.height}` };
}
const median = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const pct = (a, p) => { const b = [...a].sort((x, y) => x - y), i = (b.length - 1) * p / 100, lo = Math.floor(i); return b[lo] + (b[Math.ceil(i)] - b[lo]) * (i - lo); };

function subtitleShare(path) {
  const w = 640, h = 360, buf = run(['-i', path, '-an', '-vf', `fps=1,scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-']), n = buf.length / (w * h);
  let hits = 0;
  for (let f = 0; f < n; f++) {
    const o = f * w * h; let best = 0;
    for (let y = Math.floor(h * .8); y < Math.floor(h * .97); y++) {
      let c = 0; const x0 = Math.floor(w * .15), x1 = Math.floor(w * .85);
      for (let x = x0; x < x1 - 1; x++) if (Math.abs(buf[o + y * w + x + 1] - buf[o + y * w + x]) > 45) c++;
      best = Math.max(best, c / (x1 - x0 - 1));
    }
    if (best > .12) hits++;
  }
  return n ? hits / n : 0;
}

export function videoMetrics(path) {
  const { duration, fps, size } = probe(path);
  const buf = run(['-i', path, '-an', '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-']), N = buf.length / (W * H);
  const d = []; for (let f = 1; f < N; f++) { let s = 0; const a = (f - 1) * W * H, b = f * W * H; for (let i = 0; i < W * H; i++) s += Math.abs(buf[b + i] - buf[a + i]); d.push(s / (W * H)); }
  const med = d.map((_, i) => median(d.slice(Math.max(0, i - 12), i + 12)));
  const cuts = []; d.forEach((v, i) => { if (v > CUT && v > 3 * med[i] + 1 && (!cuts.length || i - cuts[cuts.length - 1] > 3)) cuts.push(i); });
  const bounds = [0, ...cuts.map(i => (i + 1) / FPS), N / FPS], shots = bounds.slice(1).map((b, i) => b - bounds[i]);
  const r2 = x => +x.toFixed(2), r3 = x => +x.toFixed(3);
  return {
    file: path.split('/').pop(), duration_s: r2(duration), fps, size, cuts: cuts.length, cut_times_s: cuts.map(i => r2((i + 1) / FPS)),
    shot_len_s: { mean: r2(shots.reduce((a, b) => a + b, 0) / shots.length), median: r2(median(shots)), p10: r2(pct(shots, 10)), p90: r2(pct(shots, 90)) },
    shots_1p4_4s: r3(shots.filter(s => s >= 1.4 && s <= 4).length / shots.length),
    still_ratio: r3(d.filter(v => v < STILL).length / d.length), motion_mean: r2(d.reduce((a, b) => a + b, 0) / d.length),
    bottom_band_text: r3(subtitleShare(path)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) for (const f of process.argv.slice(2)) { const m = videoMetrics(f); delete m.cut_times_s; console.log(JSON.stringify(m)); }
