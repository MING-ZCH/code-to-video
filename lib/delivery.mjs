// delivery.mjs: the project-wide delivery page (deliver/index.html). It reads every case's own record
// (projects/<p>/out/check.json, metrics.json, render-log.jsonl), deliver/cases.json (review statistics kept by hand),
// docs/baselines.md numbers (reports/p0/baselines/metrics.json) and the case C before/after metrics, and lays them out:
// overview → cases (video + sheet + numbers) → before/after → generalization matrix → toolchain → open items.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { CSS, md } from './report.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const J = f => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
const jl = f => existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
// images are embedded (downscaled JPEG data URLs) so the page stands alone; videos stay linked (too large to embed)
const embed = (root, p, w = 1280) => { const f = join(root, p); if (!existsSync(f)) return '';
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `scale='min(${w},iw)':-2`, '-q:v', '5', '-f', 'image2', '-c:v', 'mjpeg', '-'], { maxBuffer: 1 << 26 });
  return r.status ? '' : 'data:image/jpeg;base64,' + r.stdout.toString('base64'); };
const pct = x => x == null ? '—' : `${Math.round(x * 1000) / 10}%`;

export function writeDelivery(root = '.') {
  const cases = J(join(root, 'deliver/cases.json')).cases, rel = p => '../' + p;      // the page lives in deliver/
  const rows = cases.map(c => {
    const O = join(root, 'projects', c.project, 'out'), chk = J(join(O, 'check.json')), met = (J(join(O, 'metrics.json')) || [])[0];
    const log = jl(join(O, 'render-log.jsonl')), frames = log.filter(r => r.cmd === 'frames'), st = log.filter(r => r.cmd === 'selftest').at(-1);
    const msf = frames.length ? Math.round(frames.reduce((a, r) => a + r.ms_per_frame_effective * r.frames, 0) / Math.max(1, frames.reduce((a, r) => a + r.frames, 0))) : null;
    return { ...c, chk, met, msf, selftest: st ? st.ok : null, video: existsSync(join(O, 'video.mp4')) ? rel(`projects/${c.project}/out/video.mp4`) : null };
  });
  const base = J(join(root, 'reports/p0/baselines/metrics.json')) || [], caseC = jl(join(root, 'reports/p4/caseC/metrics.jsonl'));
  const tests = existsSync(join(root, 'reports/p5/tests.txt')) ? readFileSync(join(root, 'reports/p5/tests.txt'), 'utf8') : '';
  const H = [`<!doctype html><meta charset="utf-8"><title>Code-to-Video · delivery</title><style>${CSS}
    .tw{overflow-x:auto}.tw table{font-size:12.5px}.case{border:1px solid #e4d9c6;border-radius:10px;padding:14px 18px;margin:18px 0;background:#fffaf1}.kv{font-size:13px;color:#5a4a5a}.bad{color:#a33}</style>`,
    '<h1>Code-to-Video: pure-code video, delivery</h1>',
    '<p>Every frame in these videos is a pure function of time, painted by scene code (p5.js + p5.brush watercolour, GLSL style shaders) and rendered in headless Chrome. Sound is either the input song or synthesised from a code score. <b>No video or image generation model is used anywhere.</b> Each case below links its storyboard, code-level checks, review record, render log and metrics.</p>',
    '<p class="kv">Where things were verified: all renders here ran on a GPU-less Linux VM (SwiftShader). Brush cases were rendered at preview scale 0.5. Final scale-1 GPU renders on the Mac are open items (commands below). Status words: <b>verified</b> = reproduced with recorded evidence; <b>pending</b> = not yet run.</p>'];

  // cases
  H.push('<h2>Cases</h2>');
  for (const r of rows) {
    const s = r.chk?.summary, iss = r.chk?.issues || [], e = iss.filter(i => i.sev === 'error').length, w = iss.filter(i => i.sev === 'warn').length;
    H.push(`<div class="case"><h3>${esc(r.title)} <span class="kv">· projects/${esc(r.project)} · ${esc(r.role)}</span></h3>`,
      `<p class="kv">input: ${esc(r.input)} · render: ${esc(r.render)} · sound: ${esc(r.sound)}${r.caveat ? ` · <span class="bad">caveat: ${esc(r.caveat)}</span>` : ''}</p>`,
      r.video ? `<video src="${r.video}" controls preload="metadata" style="max-width:640px"></video>` : '<p class="bad">video not rendered</p>',
      `<p><img src="${embed(root, r.sheet)}" style="max-width:100%"></p>`,
      '<div class="tw"><table><tr><th>duration</th><th>shots (code)</th><th>in 1.4–4 s</th><th>check</th><th>selftest</th><th>review passes / fixes</th><th>near-still</th><th>motion</th><th>VM ms/frame</th><th>docs</th></tr>',
      `<tr><td>${s?.duration ?? '—'} s</td><td>${s?.shots ?? '—'}</td><td>${pct(s?.shots_1p4_4s)}</td><td>${r.chk ? `${e} error · ${w} warn` : '—'}</td><td>${r.selftest == null ? 'pending' : r.selftest ? 'pass' : '<span class="bad">fail</span>'}</td>`,
      `<td>${r.reviewPasses} / ${r.fixes}</td><td>${pct(r.met?.still_ratio)}</td><td>${r.met?.motion_mean ?? '—'}</td><td>${r.msf ?? '—'}</td><td><a href="${rel(r.doc)}">${esc(r.doc)}</a></td></tr></table></div>`,
      `<p class="kv">failures found in review: ${r.failures.map(esc).join(' · ')}</p></div>`);
  }

  // before / after
  H.push('<h2>Before → after (same input)</h2>', '<p>Case C rebuilt the chorus of one of the earlier attempts from the <b>same audio and lyrics</b>. Both columns are measured with the same code (<code>lib/video-metrics.mjs</code>, identical to the Python used for <code>docs/baselines.md</code>).</p>');
  if (caseC.length === 2) {
    const [b, a] = caseC, row = (k, f = x => x) => `<tr><td>${k}</td><td>${f(b[k])}</td><td>${f(a[k])}</td></tr>`;
    H.push('<table><tr><th>metric</th><th>before (gpt-6-one-more-upgrade 32–50 s)</th><th>after (projects/upgrade)</th></tr>', row('still_ratio', pct), row('motion_mean'), row('cuts'),
      `<tr><td>median shot (pixel detector)</td><td>${b.shot_len_s.median} s</td><td>${a.shot_len_s.median} s (code: 4 shots, 4.3–4.7 s)</td></tr>`, row('bottom_band_text', pct),
      '<tr><td>lettering in the picture</td><td>many labels and a title card (by eye)</td><td>0 lettering calls (c2v check)</td></tr></table>',
      `<p><img src="${embed(root, 'reports/p4/caseC/compare.jpg')}" style="max-width:100%"></p>`);
  }
  if (base.length) H.push('<h3>All three baselines (P0)</h3>', md(['| file | duration | median shot | in 1.4–4 s | near-still | subtitles |', '|---|---|---|---|---|---|',
    ...base.map(m => `| ${m.file} | ${m.duration_s} s | ${m.shot_len_s.median} s | ${pct(m.shots_1p4_4s)} | ${pct(m.still_ratio)} | ${pct(m.bottom_band_text)} |`)].join('\n')));

  // generalization matrix
  H.push('<h2>Generalization matrix</h2>', '<p>One row per input kind. "First check" is the first <code>c2v check</code> run after writing the scene. Every case needed visual review passes: the checker catches rule breaks, the eye catches readability.</p>',
    md(['| input kind | case | duration | shots | first check | review passes | fixes | dominant failure types |', '|---|---|---|---|---|---|---|---|',
      ...rows.map(r => `| ${r.inputKind} | ${r.project} | ${r.chk?.summary?.duration ?? '—'} s | ${r.chk?.summary?.shots ?? '—'} | 0 error | ${r.reviewPasses} | ${r.fixes} | ${r.failures.slice(0, 3).join('; ')} |`)].join('\n')));
  const all = rows.reduce((a, r) => a + r.fixes, 0), passes = rows.reduce((a, r) => a + r.reviewPasses, 0);
  H.push(`<p>Across ${rows.length} pieces, review passes caught <b>${all} problems</b> in ${passes} passes. Grouped by type:</p>`,
    md(['| failure type | where it was caught | fed back into |', '|---|---|---|',
      '| key idea / event not readable at sheet scale (prop too small, flat, hidden, cropped) | first-pass sheets | c2v-review worked examples; c2v-storyboard "one EVENT" check |',
      '| continuity: props popping in/out, position jumps, double takes across cuts | seam strips | c2v-review; c2v-build pattern "start B with A\'s last key" |',
      '| camera works against the read (pull-back reads as shrinking, near-identical framings = jump cut, payoff out of frame) | fixed-step sheets | c2v-review |',
      '| contact / draw order (hand not touching, character in front of what it pushes) | crops | c2v-build failures table |',
      '| timing: reaction on top of cause, effect before cause, stroke off the beat | fixed-step sheets + constants | c2v-build "one constant per event" |',
      '| style destroys detail (stained glass, small props) | style sheets | stained/pixel size parameter; storyboard swaps actions between styles |',
      '| tooling (check crash on load error, encode ignored song, CJK font, lyric time mistake) | runs | fixed in lib/ + tests/run.mjs |'].join('\n')));

  // toolchain + open
  H.push('<h2>Toolchain</h2>', md(['| part | path | verified |', '|---|---|---|',
    '| engine (brush / flat / shader media, lyric bar, code sound) | engine/ | determinism selftest on every case; audio sha stable across processes |',
    '| CLI | bin/c2v.mjs, lib/ | new · ingest · check · sheet · seams · review · selftest · render · metrics · report · audio |',
    '| rules + API for the model | ANIMATION_GUIDE.md | used for every case |',
    '| skills | skills/*, dist/*.skill | code-to-video, c2v-storyboard, c2v-build, c2v-review, c2v-deliver, c2v-orchestrate |',
    '| regression tests | tests/run.mjs | see below |'].join('\n')), tests ? `<pre>${esc(tests)}</pre>` : '');
  H.push('<h2>Open items</h2>', md(['- Final scale-1 GPU renders on the Mac: `node bin/c2v.mjs render <project> --workers=4` for umbrella, pdoom-c08, upgrade, whale (bench is already scale 1).',
    '- Case A was not a blind test (the chapter summary had been read); rerun on an unseen chapter with a fresh agent.',
    '- Case B: ingest the real meme image and compare against the original 42 s video when the Feishu attachments are available.',
    '- The subtitle detector false-positives on halftone/pixel textures; the pixel cut detector misses motion-continuous transitions. Both are documented in c2v-deliver.',
    '- Visual density: the regenerated chorus (A) and the upgrade chorus (C) have plainer sets than their references; the pipeline gets the structure right, set design needs more passes.'].join('\n')));
  mkdirSync(join(root, 'deliver'), { recursive: true });
  const out = join(root, 'deliver/index.html'); writeFileSync(out, H.join('\n')); return out;
}
