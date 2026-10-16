// tests/run.mjs: regression tests for the c2v toolchain. node tests/run.mjs [--fast] [--soft-gl]
//   parsers (lyrics, script read times), audio analysis (pdoom.mp3 ground truth: 88 BPM, first beat 0.21 s, from the
//   PDoomVideo guide), video metrics (equal to the numbers in reports/p0/baselines/metrics.json), and `c2v check` on a
//   fixture that breaks every rule on purpose. --fast skips the steps that launch Chrome. Exit 1 on any failure.
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
// fs.cpSync fails on some mounted folders (EACCES on copied directory modes): copy file by file
const copyDir = (a, b) => { mkdirSync(b, { recursive: true }); for (const f of readdirSync(a)) statSync(join(a, f)).isDirectory() ? copyDir(join(a, f), join(b, f)) : copyFileSync(join(a, f), join(b, f)); };
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { parseLyrics, parseScript, readTime, kindOf } from '../lib/ingest.mjs';
import { analyzeAudio } from '../lib/audio-analysis.mjs';
import { videoMetrics } from '../lib/video-metrics.mjs';

process.chdir(new URL('..', import.meta.url).pathname);
const fast = process.argv.includes('--fast'), soft = process.argv.includes('--soft-gl');
let fails = 0; const ok = (cond, what, got = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}${got !== '' ? '  → ' + got : ''}`); if (!cond) fails++; };

// syntax: every lib/engine/bin file parses (a comment that swallows code fails here first)
{ const files = [...readdirSync('lib').map(f => 'lib/' + f), ...readdirSync('engine').map(f => 'engine/' + f), 'bin/c2v.mjs', 'render.mjs'].filter(f => /\.m?js$/.test(f));
  const bad = files.filter(f => spawnSync(process.execPath, ['--check', f]).status !== 0);
  ok(!bad.length, `syntax: ${files.length} engine/lib/bin files parse`, bad.join(' ')); }

// parsers
const L = parseLyrics(readFileSync('tests/inputs/song.lrc', 'utf8'));
ok(L.length === 5 && L[0][0] === 1.2 && L[0][1] === 3.8 && L[3][2] === 'We never asked it back', 'LRC: 5 lines, multi-tag line expanded, end = next start', JSON.stringify(L[0]));
ok(kindOf('tests/inputs/song.lrc') === 'lyrics' && kindOf('tests/inputs/script.md') === 'script', 'kindOf: lyrics vs script');
const B = parseScript(readFileSync('tests/inputs/script.md', 'utf8'));
ok(B.length === 6 && B.every(b => b.t1 - b.t0 >= 1.4 - 1e-9 && b.t1 - b.t0 <= 4 + 1e-9), 'script: 6 beats, each 1.4–4 s', B.map(b => +(b.t1 - b.t0).toFixed(2)).join(','));
ok(readTime('雨停了，太阳出来，小船上落了一只蝴蝶。') > readTime('Rain stops.'), 'read time grows with CJK length');

// audio analysis vs ground truth
const song = `${homedir()}/tools/refs/PDoomVideo/assets/pdoom.mp3`;
if (existsSync(song)) {
  const a = analyzeAudio(song), phaseErr = Math.abs(((a.offset - .21) % a.beat + a.beat * 1.5) % a.beat - a.beat / 2);
  ok(Math.abs(a.bpm - 88) <= .5, 'pdoom.mp3 tempo 88 BPM', a.bpm);
  ok(phaseErr <= 1 / 24, 'pdoom.mp3 first beat within one frame of 0.21 s', `${a.offset} (err ${phaseErr.toFixed(3)} s)`);
  ok(a.confidence === 'high', 'pdoom.mp3 confidence high', `${a.confidence} (${a.contrast})`);
} else console.log(`SKIP  audio ground truth (${song} not found: clone JohnHeibel/PDoomVideo to ~/tools/refs/)`);

// video metrics vs the P0 baseline numbers (Python implementation)
const base = 'gpt-6-one-more-upgrade.mp4';
if (existsSync(base) && existsSync('reports/p0/baselines/metrics.json')) {
  const ref = JSON.parse(readFileSync('reports/p0/baselines/metrics.json', 'utf8')).find(m => m.file === base), m = videoMetrics(base);
  const keys = ['cuts', 'shots_1p4_4s', 'still_ratio', 'motion_mean', 'bottom_band_text'];
  ok(keys.every(k => Math.abs(m[k] - ref[k]) < 1e-6) && m.shot_len_s.median === ref.shot_len_s.median, 'JS video metrics == Python baseline metrics', keys.map(k => `${k}=${m[k]}`).join(' '));
} else console.log('SKIP  video metrics regression (baseline MP4 not present)');

// c2v check on the rule-breaking fixture
if (!fast) {
  copyDir('tests/fixture-bad', 'projects/_fixture-bad');
  try {
    const r = spawnSync(process.execPath, ['bin/c2v.mjs', 'check', '_fixture-bad', ...(soft ? ['--soft-gl'] : [])], { encoding: 'utf8' });
    const res = JSON.parse(readFileSync('projects/_fixture-bad/out/check.json', 'utf8')), has = re => res.issues.some(i => re.test(i.msg));
    ok(r.status === 1, 'check exits 1 when there are errors', r.status);
    ok(has(/Math\.random/) && has(/wall-clock/) && has(/outer variable "counter"/), 'check: determinism errors (Math.random, Date.now, outer state)');
    ok(has(/plain p5 shape/) && has(/plain p5 fill/) && has(/3D call/), 'check: medium warnings (rect, fill, rotateY)');
    ok(res.issues.filter(i => /^seam at/.test(i.msg)).length === 5, 'check: all 5 seams flagged (opening, 3 cuts, ending)');
    ok(has(/0\.6 s: shorter/) && has(/8\.1 s: long/) && has(/outside 0–12/) && has(/no storyboard/), 'check: shot lengths, score range, storyboard');
    ok(!res.issues.some(i => i.line === 11), 'check: a rule word inside a comment is not flagged');
  } finally { rmSync('projects/_fixture-bad', { recursive: true, force: true }); }
  // determinism under many overlapping glows (the textured glow failed this; RSI round 1)
  copyDir('tests/fixture-glow', 'projects/_fixture-glow');
  try {
    const r = spawnSync(process.execPath, ['render.mjs', '--project=_fixture-glow', '--selftest=0.5,1.0,1.5', ...(soft ? ['--soft-gl'] : [])], { encoding: 'utf8' });
    ok(/SELFTEST PASS/.test(r.stdout), 'determinism: 60 overlapping glows render byte-identically 3 ways', (r.stdout.match(/SELFTEST \w+/) || [''])[0]);
  } finally { rmSync('projects/_fixture-glow', { recursive: true, force: true }); }
  // a scene with a syntax error must be reported, not crash the checker
  mkdirSync('projects/_fixture-syntax/scenes', { recursive: true });
  try {
    copyFileSync('tests/fixture-bad/project.js', 'projects/_fixture-syntax/project.js');
    writeFileSync('projects/_fixture-syntax/scenes/bad.js', '(() => { function a(t) { emotions(t, [[0, "happy"]]   // ]); oops\n  shots([[0, a]]); })();\n');
    const r = spawnSync(process.execPath, ['bin/c2v.mjs', 'check', '_fixture-syntax', ...(soft ? ['--soft-gl'] : [])], { encoding: 'utf8' });
    const res = JSON.parse(readFileSync('projects/_fixture-syntax/out/check.json', 'utf8'));
    ok(r.status === 1 && res.issues.some(i => /no shots registered/.test(i.msg)) && res.issues.some(i => i.file === 'page'), 'check: a scene syntax error is reported (page error + no shots), not a crash');
  } finally { rmSync('projects/_fixture-syntax', { recursive: true, force: true }); }
} else console.log('SKIP  c2v check fixture (--fast)');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
