#!/usr/bin/env node
// c2v: the Code-to-Video command line. One entry point for the workflow in ANIMATION_GUIDE.md:
//   ingest → storyboard → build → check → look (sheet/seams/review) → render → metrics → report.
//
//   c2v new <name> [--from=<file>] [--duration=10] [--bpm=120] [--medium=brush|flat]   scaffold projects/<name>/
//   c2v ingest <name> <file>                    parse an input into projects/<name>/input/brief.{json,md}
//   c2v check <name>                            static + runtime rule checks → out/check.{json,md}; exit 1 on errors
//   c2v sheet <name> [--every=0.15]             contact sheet: first/middle/last frame of every shot (or a fixed step)
//   c2v seams <name>                            a strip of every frame ±0.25 s around each shot seam
//   c2v review <name>                           check + sheet + seams + REVIEW.md checklist to fill in
//   c2v reads <name>                            R1 size · R2 in frame · R3 seam continuity · R4 jump cut, from focus() declarations
//   c2v cost <name> [--skip=a,b]                ms/frame per shot; over-budget shots; what skipping each tagged part saves
//   c2v selftest <name>                         determinism: shot midpoints rendered 3 ways (scale 1)
//   c2v render <name> [--workers=4]             final frames (resumable) + synth + encode → out/video.mp4, then metrics
//   c2v metrics <name|file.mp4 …>               timing/motion/subtitle metrics (same definitions as docs/baselines.md)
//   c2v report <name>                           out/report.html: storyboard, checks, sheets, metrics, video
//   c2v audio <file>                            tempo / first beat / sections of a song
//   c2v deliver                                 deliver/index.html: every case, before/after, generalization matrix
//   c2v assets <name> search|fetch|list|credits|restore   real-world media (lib/assets.mjs) with licence + sha256 lock
//   c2v pairs <name> [--only=a,b] [--scale=.5]  edit pairs: base + one video per PROJECT.params edit, diff masks, pairs.jsonl
// Render flags pass through to render.mjs: --scale, --medium, --soft-gl, --gpu-angle, --chrome, --workers.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const argv = process.argv.slice(2), pos = argv.filter(a => !a.startsWith('--')), opt = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const [cmd, name, ...rest] = pos;
const PDIR = name ? join('projects', name) : null, OUT = PDIR ? join(PDIR, 'out') : null;
const PASS = ['scale', 'medium', 'soft-gl', 'gpu-angle', 'chrome'].filter(k => opt[k] !== undefined).map(k => opt[k] === true ? `--${k}` : `--${k}=${opt[k]}`);
const die = m => { console.error('c2v: ' + m); process.exit(1); };
const need = () => { if (!name) die(`usage: c2v ${cmd} <name>`); if (cmd !== 'new' && !existsSync(join(PDIR, 'project.js'))) die(`no project ${PDIR}`); };
const render = (...a) => { const r = spawnSync(process.execPath, ['render.mjs', `--project=${name}`, ...PASS, ...a], { stdio: 'inherit' }); if (r.status) die(`render.mjs ${a.join(' ')} failed`); };
const fmt = x => (+x).toFixed(2);

async function shotList() {
  const { openStudio } = await import('../lib/page.mjs');
  const { browser, page } = await openStudio(name, { softGl: opt['soft-gl'], chrome: opt.chrome });
  const r = await page.evaluate(() => ({ dur: DUR, shots: SHOTS.map(s => s[0]) })); await browser.close();
  return r.shots.map((t0, i) => ({ t0, t1: i + 1 < r.shots.length ? r.shots[i + 1] : r.dur }));
}

const commands = {
  async new() {
    need(); if (existsSync(PDIR)) die(`${PDIR} already exists`);
    mkdirSync(join(PDIR, 'scenes'), { recursive: true }); mkdirSync(join(PDIR, 'assets'), { recursive: true });
    let brief = null; if (opt.from) { const { ingest } = await import('../lib/ingest.mjs'); brief = ingest(resolve(opt.from), PDIR); }
    const dur = +(opt.duration || brief?.duration || 10), music = brief?.music;
    const P = { duration: dur, bpm: +(opt.bpm || music?.bpm || 120), offset: music?.offset ?? 0, scenes: ['main.js'] };
    if (opt.medium) P.medium = opt.medium; if (brief?.audio) P.audio = brief.audio;
    if (brief?.lines && opt.karaoke) P.karaoke = { lines: brief.lines };
    writeFileSync(join(PDIR, 'project.js'), `// ${name}: see STORYBOARD.md. Loaded before the engine.\nconst PROJECT = ${JSON.stringify(P, null, 1).replace(/\n\s*/g, ' ')};\n`);
    writeFileSync(join(PDIR, 'STORYBOARD.md'), storyboardTemplate(name, dur, brief));
    writeFileSync(join(PDIR, 'scenes', 'main.js'), sceneTemplate(dur));
    console.log(`created ${PDIR}/ (project.js, STORYBOARD.md, scenes/main.js${brief ? ', input/brief.md' : ''})\nnext: write STORYBOARD.md, then build scenes/main.js; preview studio.html?project=${name}`);
  },
  async ingest() {
    need(); const file = rest[0] || opt.from; if (!file) die('usage: c2v ingest <name> <file>');
    const { ingest } = await import('../lib/ingest.mjs'); const b = ingest(resolve(file), PDIR);
    console.log(readFileSync(join(PDIR, 'input', 'brief.md'), 'utf8').split('\n').slice(0, 30).join('\n')); return b;
  },
  async check() {
    need(); const { staticCheck, runtimeCheck, checkMarkdown } = await import('../lib/check.mjs'); const { openStudio } = await import('../lib/page.mjs');
    const { browser, page, errors } = await openStudio(name, { softGl: opt['soft-gl'], chrome: opt.chrome });
    const scenes = await page.evaluate(() => PROJECT.scenes || []); const rt = await runtimeCheck(page, PDIR); await browser.close();
    const st = staticCheck(PDIR, scenes, { text: rt.summary.text });
    const res = { project: name, at: new Date().toISOString(), summary: rt.summary, shots: rt.shots, texts: st.texts,
      issues: [...errors.filter(e => !/INVALID_OPERATION|not from the associated program/.test(e)).map(e => ({ sev: 'error', file: 'page', line: 0, msg: e })), ...st.issues, ...rt.issues] };
    mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, 'check.json'), JSON.stringify(res, null, 1)); const md = checkMarkdown(name, res); writeFileSync(join(OUT, 'check.md'), md);
    console.log(md); if (res.issues.some(i => i.sev === 'error')) process.exitCode = 1;
  },
  async sheet() {
    need(); const shots = await shotList(); let ts;
    if (opt.every) { ts = []; const end = shots.at(-1).t1; for (let t = 0; t < end; t += +opt.every) ts.push(fmt(t)); }
    else ts = shots.flatMap(s => [s.t0 + .08, (s.t0 + s.t1) / 2, s.t1 - .08].map(fmt));
    const per = +(opt.per || 24);
    for (let i = 0; i * per < ts.length; i++) render(`--sheet=${ts.slice(i * per, (i + 1) * per).join(',')}`, `--cols=${opt.every ? 6 : 3}`, `--w=${opt.w || 480}`, `--out=${join(OUT, 'review', `sheet_${i + 1}.jpg`)}`);
  },
  async seams() {
    need(); const shots = await shotList(), end = shots.at(-1).t1;
    const marks = [0, ...shots.slice(1).map(s => s.t0), end];
    marks.forEach((m, i) => render(`--strip=${fmt(Math.max(0, m - .25))}:${fmt(Math.min(end - 1 / 24, m + .25))}`, '--cols=6', '--w=320', `--out=${join(OUT, 'review', `seam_${i}.jpg`)}`));
  },
  async review() {
    need(); await commands.check(); await commands.sheet(); await commands.seams();
    const shots = JSON.parse(readFileSync(join(OUT, 'check.json'), 'utf8')).shots, imgs = readdirSync(join(OUT, 'review')).filter(f => f.endsWith('.jpg')).sort();
    const items = ['read: the event reads from the sheet alone; character big enough, separates from the background', 'timing: each read gets its frames; nothing lands on top of another read',
      'motion: anticipation, follow-through, no pops, no twinning', 'boil: still things hold between boil frames', 'contacts: feet on ground, held things touch hands',
      'transitions: in and out of every shot', 'rules: no text, no 3D, no dead stretch', 'colour: no mud, no pure black/white'];
    const L = [`# Review: ${name}`, '', `Images in this folder: ${imgs.join(', ')}. Checks: ../check.md.`, '', 'Fill every box after looking at the images. Note what you changed and re-run `c2v review`.', ''];
    shots.forEach((s, i) => { L.push(`## Shot ${i + 1} · ${s.name} · ${s.t0}–${s.t1} s (${s.len} s)`, ''); for (const it of items) L.push(`- [ ] ${it}`); L.push('- notes:', ''); });
    writeFileSync(join(OUT, 'review', 'REVIEW.md'), L.join('\n')); console.log(`wrote ${join(OUT, 'review', 'REVIEW.md')}`);
  },
  async reads() {
    need(); const { readsCheck } = await import('../lib/reads.mjs'); const { openStudio } = await import('../lib/page.mjs');
    const { browser, page } = await openStudio(name, { softGl: opt['soft-gl'], chrome: opt.chrome, medium: opt.medium || 'flat', scale: opt.scale || .5 });
    const r = await readsCheck(page, PDIR); await browser.close();
    mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, 'reads.json'), JSON.stringify(r, null, 1));
    const L = [`# c2v reads: ${name}`, '', `${r.shots} shots · ${r.samples} samples · declared: ${r.declared.join(', ') || '(none)'}`, ''];
    for (const i of r.issues) L.push(`- [${i.sev}] ${i.cls} ${i.shot} @${i.t}s — ${i.msg}`);
    if (!r.issues.length) L.push('no R1–R6 issues'); console.log(L.join('\n')); writeFileSync(join(OUT, 'reads.md'), L.join('\n') + '\n');
    if (r.issues.some(i => i.sev === 'warn')) process.exitCode = 3;
  },
  async cost() {
    need(); const { costCheck } = await import('../lib/cost.mjs');
    const r = await costCheck(name, { softGl: opt['soft-gl'], chrome: opt.chrome, scale: opt.scale, medium: opt.medium, skip: opt.skip });
    const L = [`# c2v cost: ${name} (medium ${opt.medium || 'brush'}, scale ${opt.scale || .5})`, '', '| shot | t | ms/frame | fill (frames) |', '|---|---|---|---|', ...r.shots.map(s => `| ${s.name} | ${s.t} | ${s.ms} | ${s.fill} |`)];
    if (r.skips.length) L.push('', `skips at ${r.slowest}:`, ...r.skips.map(x => `- skip ${x.skip}: ${x.ms} ms (saves ${x.saves})`));
    for (const i of r.issues) L.push(`- [${i.sev}] ${i.cls} ${i.msg}`);
    console.log(L.join('\n')); mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, 'cost.md'), L.join('\n') + '\n');
  },
  async selftest() { need(); const shots = await shotList(); render(`--selftest=${shots.slice(0, 6).map(s => fmt((s.t0 + s.t1) / 2)).join(',')}`); },
  async render() {
    need(); render('--frames', `--workers=${opt.workers || 4}`); render('--synth'); render('--encode');
    await commands.metrics();
  },
  async metrics() {
    const { videoMetrics } = await import('../lib/video-metrics.mjs');
    const files = name && existsSync(join('projects', name, 'project.js')) ? [join(OUT, 'video.mp4')] : pos.slice(1);
    const res = files.map(f => videoMetrics(f)); for (const m of res) { const { cut_times_s, ...r } = m; console.log(JSON.stringify(r)); }
    if (OUT && existsSync(OUT)) writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(res, null, 1));
  },
  async assets() {
    need(); const A = await import('../lib/assets.mjs'), [sub, a1, ...a2] = rest;
    if (sub === 'search') {
      const hits = await A.search(a1, a2.join(' '), opt);
      hits.forEach((h, i) => console.log(`${String(i + 1).padStart(2)}. ${a1}:${h.id}\n    ${h.type || ''} ${h.size || ''} ${h.dur ? (+h.dur).toFixed(1) + ' s' : ''} · ${h.license} · ${h.author}`));
    } else if (sub === 'fetch') {
      const r = await A.fetchAsset(PDIR, a1, { ...opt, as: opt.as });
      console.log(`${opt.as}: ${r.meta.kind} ${JSON.stringify(r.meta)} · ${r.license} · sha256 ${r.sha256.slice(0, 12)}`);
    } else if (sub === 'restore') console.log((await A.restore(PDIR)).join('\n'));
    else if (sub === 'credits') console.log(A.credits(PDIR));
    else console.log(A.list(PDIR) || 'no assets: c2v assets <name> search <source> <query>');
  },
  async blender() {
    need(); const scene = rest[0]; if (!scene || !opt.as) die('usage: c2v blender <name> <scene.py> --as=<asset> [--params=json] [--frames=120] [--scale=.5] [--samples=64] [--only=1,60]');
    const { registerLayer } = await import('../lib/assets.mjs'), sc = +(opt.scale || 1), out = join(PDIR, 'assets', opt.as);
    const args = ['-b', '--factory-startup', '--python', 'blender/render_layer.py', '--', '--scene', resolve(scene), '--out', out, '--project', PDIR,
      '--params', opt.params || '{}', '--frames', String(opt.frames || 120), '--fps', String(opt.fps || 24), '--width', String(Math.round(1920 * sc)), '--height', String(Math.round(1080 * sc)),
      '--samples', String(opt.samples || 64), ...(opt.only ? ['--only', String(opt.only)] : [])];
    const t0 = Date.now(), r = spawnSync(process.env.BLENDER || 'blender', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
    const line = (r.stdout || '').split('\n').find(l => l.startsWith('C2V_META '));
    if (r.status || !line) { console.error((r.stdout || '').split('\n').filter(l => /Error|Traceback|error/i.test(l)).slice(-20).join('\n'), r.stderr); die('blender failed'); }
    const meta = JSON.parse(line.slice(9)), e = registerLayer(PDIR, opt.as, scene, meta);
    console.log(`${opt.as}: ${meta.rendered}/${meta.frames} frames ${meta.w}x${meta.h} · build ${meta.build_s} s · ${meta.render_s_per_frame} s/frame · total ${((Date.now() - t0) / 1000).toFixed(0)} s · sha256 ${e.sha256.slice(0, 12)}`);
  },
  async pairs() { need(); const { runPairs } = await import('../lib/pairs.mjs'); await runPairs(name, opt); },
  async report() { need(); const { writeReport } = await import('../lib/report.mjs'); console.log('wrote ' + writeReport(name)); },
  async deliver() { const { writeDelivery } = await import('../lib/delivery.mjs'); console.log('wrote ' + writeDelivery('.')); },
  async audio() { const { analyzeAudio } = await import('../lib/audio-analysis.mjs'); const { sections, ...a } = analyzeAudio(name); console.log(JSON.stringify(a, null, 1)); },
};

function storyboardTemplate(name, dur, b) {
  const L = [`# ${name}: storyboard`, '', '> Write this before any scene code (ANIMATION_GUIDE rule 7). Every shot: an EVENT, a reaction, a camera, reads with times, a transition.', '',
    'Logline: one sentence. ___ wants ___, but ___, so ___.', 'World: setting, a small palette, light, how the colour changes across the video.', 'Motif: the thing that recurs and pays off.', 'Arc: the emotion keys across the whole video.', '', 'Shots:'];
  const plan = b?.lines ? b.lines.map(([t0, t1, t]) => [t0, t1, `lyric: "${t}" (act it, don't write it)`]) : b?.beats ? b.beats.map(x => [x.t0, x.t1, `beat: ${x.text}`])
    : b?.shots ? b.shots.slice(0, 40).map(s => [s.t0, s.t1, `source shot (${s.len} s): adapt, don't copy`]) : [[0, dur, 'the whole idea']];
  const letter = i => i < 26 ? String.fromCharCode(65 + i) : 'Z' + (i - 25);
  plan.forEach(([t0, t1, what], i) => L.push(`  ${letter(i)}  ${fmt(t0)}–${fmt(t1)}  [transition${i ? '' : ' in'}: ___]  ${what} · the EVENT · reaction · camera`, `     reads:  ${fmt(t0)}–${fmt(t0 + Math.min(1.2, (t1 - t0) / 2))}  ___`, ''));
  L.push('  [transition out: ___]', '');
  if (b) L.push('Input brief: input/brief.md', '');
  return L.join('\n');
}
function sceneTemplate(dur) {
  return `// main.js: replace this placeholder with the storyboard's shots. Each shot fn(t, lt, dur) paints the whole frame and is a
// pure function of t (no Math.random, no state between frames). Run \`node bin/c2v.mjs check <name>\` often.
(() => {
  function opening(t, lt, dur) {
    camBegin(960 + 20 * Math.sin(lt * .6), 540, 1 + .02 * lt);
    boilSeed('bg'); paint(rectPts(-200, -200, W + 400, H + 400), { wash: PAL.sky, ink: null });
    boilSeed('ground'); paint(ellPts(960, 1150, 1400, 380, 40, 2), { wash: PAL.sap, ink: PAL.ink, sw: 1 });
    clawd(960, 860, 26, emotions(lt, [[0, 'neutral'], [1.2, 'thinking'], [2.4, 'happy']]));
    const at = toScreen(960, 860 - 4 * 26);
    camEnd();
    if (lt < .45) iris(...at, lerp(0, 1500, easeIn(lt / .45)));           // transition in
    if (lt > dur - .6) iris(...at, lerp(1500, 0, easeIn((lt - (dur - .6)) / .55)));   // transition out
  }
  shots([[0, opening]]);
})();
`;
}

if (!commands[cmd]) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 21).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 1 : 0); }
await commands[cmd]();
