// render.mjs: renders studio.html?project=<name> in headless Chrome. Length and fps come from the page (PROJECT).
// Based on ClaudeAnimationBase/render.mjs (MIT, John Heibel); multi-project paths, self-test and run log added here.
//
//   Every command takes --project=<name> (default: demo). Outputs default to projects/<name>/out/.
//   Look at it:
//     node render.mjs --project=demo --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] [--out=…/a.jpg]   contact sheet of chosen times
//     node render.mjs --project=demo --strip=2.0:2.5 [--cols=6] [--w=320]                        EVERY frame in a stretch
//     node render.mjs --project=demo --sheet=2.1,2.2 --crop=760,300,400,400 --w=600                full-res crops
//     node render.mjs --project=demo --strip=2.0:2.5 --crop-at=960,780,500,400                     crops following a WORLD point
//     node render.mjs --project=demo --stills=1.2,3.4                                              full-res PNGs
//   Check it:
//     node render.mjs --project=demo --selftest=0.5,3.2,7.9      each time rendered 3 ways (A, A again, B after other
//                                                                times) and compared byte-for-byte: frames must be f(t)
//   Make the video:
//     node render.mjs --project=demo --clip [--range=0:4]                      straight to MP4 (one worker)
//     node render.mjs --project=demo --frames [--range=0:8] --workers=4        JPEG frames → out/frames (parallel, resumable)
//     node render.mjs --project=demo --encode                                  out/frames → MP4
//   Sound: --synth writes the project's code-generated score to out/synth.wav (clip/encode use it automatically).
//   Loops: add --loop=<name> (times are loop times), or --loop=emotions --png for a PNG cycle.
//   Preview: --scale=0.5 renders the WebGL layer at half resolution (≈4x cheaper fills) for checks; never for finals.
//   Edits: --params='{"temp":-.3}' overrides PROJECT.params for this render (c2v pairs uses it).
//   Other flags: --audio=<file> (else PROJECT.audio), --fps=24, --chrome=<path>, --soft-gl (no GPU: SwiftShader),
//   --gpu-angle=vulkan|gl-egl (headless Linux + NVIDIA).
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, renameSync, readdirSync, appendFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome, gpuFlags, baseFlags } from './lib/chrome.mjs';
import { createHash } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
// --studio=<path/to/studio.html> renders another kit's page instead (e.g. a reference checkout of PDoomVideo); it needs
// window.ready / renderAt / renderSheet. Outputs then go to --out-dir (default out/ref).
const STUDIO = args.studio ? resolve(args.studio) : resolve('studio.html');
const PROJ = args.studio ? 'ref:' + dirname(STUDIO).split('/').pop() : (args.project || 'demo');
const PDIR = `projects/${PROJ}`, OUT = args['out-dir'] || (args.studio ? 'out/ref' : `${PDIR}/out`);
if (!args.studio && !existsSync(`${PDIR}/project.js`)) { console.error(`no project at ${PDIR}/project.js`); process.exit(1); }

const CHROME = findChrome(args.chrome);
const fps = +(args.fps || 24), FRAMES_DIR = `${OUT}/frames`;
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
const fields = s => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map(v => isNaN(+v) ? v : +v); };
// one JSON line per command, so render costs and checks stay on record (projects/<name>/out/render-log.jsonl)
const logRun = rec => { mkdirSync(OUT, { recursive: true }); appendFileSync(`${OUT}/render-log.jsonl`, JSON.stringify({ at: new Date().toISOString(), project: PROJ, ...rec }) + '\n'); };

if (args.encode) {
  // audio: --audio, else the project's own track (PROJECT.audio, read from project.js), else code-generated synth.wav
  const projAudio = !args.studio && (/audio\s*:\s*['"]([^'"]+)['"]/.exec(readFileSync(`${PDIR}/project.js`, 'utf8')) || [])[1];
  const out = args.out || `${OUT}/video.mp4`, audio = args.audio || (projAudio && existsSync(projAudio) ? projAudio : '') || (existsSync(`${OUT}/synth.wav`) ? `${OUT}/synth.wav` : '');
  const nums = readdirSync(FRAMES_DIR).filter(f => /^f\d{5}\.jpg$/.test(f)).map(f => +f.slice(1, 6)).sort((a, b) => a - b), n = nums.length;
  if (!n) { console.error(`no frames in ${FRAMES_DIR}`); process.exit(1); }
  // a frame range rendered with --range may not start at 0; refuse to encode across holes (they would be silently dropped)
  const holes = nums.filter((v, i) => i && v !== nums[i - 1] + 1);
  if (holes.length) { console.error(`frames missing before ${holes.slice(0, 5).join(', ')}${holes.length > 5 ? ' …' : ''}: re-run --frames to fill them`); process.exit(1); }
  console.log(`encoding ${n} frames (f${nums[0]}–f${nums[n - 1]}) → ${out}${audio ? ' with ' + audio : ''}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-start_number', String(nums[0]), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-ss', String(nums[0] / fps), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  logRun({ cmd: 'encode', frames: n, out });
  console.log('wrote ' + out);
  process.exit(0);
}
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }

let gpu; try { gpu = gpuFlags({ softGl: args['soft-gl'], gpuAngle: args['gpu-angle'] }); } catch (e) { console.error(e.message); process.exit(1); }
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...baseFlags(), ...gpu]
});
let GPU = '';
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(STUDIO).href + `?render&project=${encodeURIComponent(PROJ)}${args.scale ? '&scale=' + args.scale : ''}${args.medium ? '&medium=' + args.medium : ''}${args.params ? '&params=' + encodeURIComponent(args.params) : ''}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  if (!GPU) GPU = await page.evaluate(() => window.gpuInfo());
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
const lengthOf = page => page.evaluate(() => window.LOOP ? window.LOOP.len : DUR);
const avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;

// Code-generated sound: the project's SCORE (engine/audio.js) rendered offline to WAV. Returns the path, or '' if no score.
async function synth(page, out = `${OUT}/synth.wav`) {
  const n = await page.evaluate(() => typeof SCORE !== 'undefined' ? SCORE.length : 0); if (!n) return '';
  const t0 = Date.now(), { wav } = await page.evaluate(() => window.renderAudio(DUR));
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, Buffer.from(wav, 'base64'));
  const sha = createHash('sha1').update(readFileSync(out)).digest('hex').slice(0, 12);
  console.log(`${out}  (${n} events, ${Date.now() - t0} ms, sha1 ${sha})`); logRun({ cmd: 'synth', events: n, sha, out });
  return out;
}

if (args.synth) {
  const page = await openPage(), out = await synth(page, typeof args.synth === 'string' ? args.synth : undefined);
  if (!out) console.log('this project has no SCORE (engine/audio.js): nothing to synthesise');
} else if (args.sheet || args.strip) {
  const page = await openPage(), out = args.out || `${OUT}/check/${args.strip ? 'strip' : 'sheet'}.jpg`; mkdirSync(dirname(out), { recursive: true });
  let ts;
  if (args.strip) { const [a, b] = span(args.strip); ts = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) ts.push(i / fps); }
  else ts = times(args.sheet);
  const crop = args.crop ? times(args.crop) : null, at = args['crop-at'] ? fields(args['crop-at']) : null;
  const { url, ms } = await page.evaluate((ts, c, w, crop, at) => window.renderSheet(ts, c, w, crop, at), ts, +(args.cols || (args.strip ? 6 : 3)), +(args.w || (args.strip ? 320 : 640)), crop, at);
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  logRun({ cmd: args.strip ? 'strip' : 'sheet', times: ts.length, ms_per_frame: avg(ms), gpu: GPU, out });
  console.log(`${out}  (${ts.length} frames)  ms/frame: ${ms.join(' ')}  · GPU: ${GPU}`);
} else if (args.selftest) {
  // Frames must be pure functions of t. Render each time in page A, again in page A, and in page B after rendering the
  // other times in reverse order (out-of-order, as parallel workers do). All three must be byte-identical PNGs.
  const ts = times(args.selftest), A = await openPage('#A'), Bp = await openPage('#B'), sha = b => createHash('sha1').update(b).digest('hex').slice(0, 12);
  const a1 = [], a2 = [], b = new Array(ts.length), bufs = {};
  const shot = async (page, t, tag) => { const buf = await frameOf(page, t, 'image/png'); bufs[`${t}_${tag}`] = buf; return sha(buf); };
  for (const t of ts) a1.push(await shot(A, t, 'A'));
  for (const t of ts) a2.push(await shot(A, t, 'again'));
  for (let i = ts.length - 1; i >= 0; i--) b[i] = await shot(Bp, ts[i], 'B');
  const rows = ts.map((t, i) => ({ t, A: a1[i], again: a2[i], B: b[i], ok: a1[i] === a2[i] && a1[i] === b[i] }));
  console.table(rows);
  const ok = rows.every(r => r.ok);
  if (!ok) {   // keep the mismatching frames for diffing (scripts/imgdiff.py)
    mkdirSync(`${OUT}/selftest`, { recursive: true });
    for (const r of rows) if (!r.ok) for (const tag of ['A', 'again', 'B']) writeFileSync(`${OUT}/selftest/t${r.t}_${tag}.png`, bufs[`${r.t}_${tag}`]);
    console.log(`mismatching frames saved to ${OUT}/selftest/`);
  }
  logRun({ cmd: 'selftest', times: ts, ok, rows, gpu: GPU });
  console.log(ok ? 'SELFTEST PASS: frames are deterministic' : 'SELFTEST FAIL: some frame depends on state or order');
  if (args.scale && +args.scale < 1) console.log('note: --scale < 1 upscales the WebGL layer; ±1 differences in the last pixel column are a preview artifact. Run selftest at scale 1 for a verdict.');
  await browser.close(); process.exit(ok ? 0 : 2);
} else if (args.stills) {
  const page = await openPage(), out = args.out || `${OUT}/stills`; mkdirSync(out, { recursive: true });
  console.log('GPU:', GPU);
  for (const s of times(args.stills)) {
    const t0 = Date.now(), buf = await frameOf(page, s, 'image/png');
    const f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`; writeFileSync(f, buf);
    console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.png) {
  const probe = await openPage(), len = await lengthOf(probe); await probe.close();
  const [a, b] = args.range ? span(args.range) : [0, len], n = Math.round((b - a) * fps);
  const out = args.out || `${OUT}/${args.loop ? 'loop_' + args.loop : 'png'}`, workers = +(args.workers || 3); mkdirSync(out, { recursive: true });
  let next = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < n) { const i = next++; writeFileSync(`${out}/f${String(i).padStart(4, '0')}.png`, await frameOf(page, a + i / fps, 'image/png')); }
  }));
  console.log(`${n} frames → ${out}  (${((Date.now() - start) / n).toFixed(0)} ms/frame)`);
} else if (args.frames) {
  // Parallel and resumable: each worker pulls the next missing frame; files are written atomically.
  const probe = await openPage(), len = await lengthOf(probe); await probe.close();
  const [a, b] = args.range ? span(args.range) : typeof args.frames === 'string' ? span(args.frames) : [0, len], workers = +(args.workers || 4);
  mkdirSync(FRAMES_DIR, { recursive: true });
  // Frames already on disk are reused only while the inputs that make them are unchanged: the project file, its scenes
  // and the asset lock (a re-rendered Blender / splat / three layer changes its sha256 there). Otherwise start over.
  const inputs = createHash('sha256');
  for (const f of [`${PDIR}/project.js`, `${PDIR}/assets.lock.json`, ...readdirSync(`${PDIR}/scenes`).filter(n => n.endsWith('.js')).sort().map(n => `${PDIR}/scenes/${n}`)])
    if (existsSync(f)) inputs.update(f).update(readFileSync(f));
  const key = inputs.digest('hex'), keyFile = `${FRAMES_DIR}/.inputs`;
  if (existsSync(keyFile) && readFileSync(keyFile, 'utf8') !== key || !existsSync(keyFile) && readdirSync(FRAMES_DIR).some(n => n.endsWith('.jpg'))) {
    for (const n of readdirSync(FRAMES_DIR)) if (n.endsWith('.jpg')) rmSync(`${FRAMES_DIR}/${n}`);
    console.log('inputs changed since the last render: frames cleared');
  }
  writeFileSync(keyFile, key);
  const first = Math.round(a * fps), last = Math.min(Math.ceil(len * fps) - 1, Math.round(b * fps) - 1);
  const todo = []; for (let i = first; i <= last; i++) { const f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < todo.length) {
      const i = todo[next++], f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`;
      const buf = await frameOf(page, i / fps, 'image/jpeg', .94);
      writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
      if (++done % 24 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame effective  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`);
      }
    }
  }));
  logRun({ cmd: 'frames', frames: todo.length, workers, ms_per_frame_effective: Math.round((Date.now() - start) / Math.max(1, todo.length)), gpu: GPU });
} else if (args.clip) {
  const page = await openPage(), len = await lengthOf(page);
  const [a, b] = args.range ? span(args.range) : typeof args.clip === 'string' ? span(args.clip) : [0, len];
  const audio = args.audio || await page.evaluate(() => PROJECT.audio || '') || await synth(page);
  const out = args.out || `${OUT}/${args.range || typeof args.clip === 'string' ? 'clip' : 'video'}.mp4`; mkdirSync(dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    ...(audio ? ['-ss', String(a), '-t', String(b - a), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((b - a) * fps), start = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await frameOf(page, a + i / fps, 'image/jpeg', .93);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 24 === 0 || i === n - 1) console.log(`frame ${i + 1}/${n}  ${((Date.now() - start) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  logRun({ cmd: 'clip', range: [a, b], frames: n, ms_per_frame: Math.round((Date.now() - start) / n), gpu: GPU, out });
  console.log(`wrote ${out}`);
} else {
  console.log('nothing to do: see the usage notes at the top of render.mjs');
}
await browser.close();
