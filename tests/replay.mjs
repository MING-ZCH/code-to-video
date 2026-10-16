// tests/replay.mjs: failure replay suite (RSI round 1). Each replay re-introduces a failure that visual review caught in
// round 0 into a COPY of the finished project, runs `c2v reads`, and passes only if the expected class is flagged.
// The clean projects must stay clean (run `c2v reads` on them). node tests/replay.mjs [--soft-gl] [name …]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openStudio } from '../lib/page.mjs';
import { readsCheck } from '../lib/reads.mjs';

process.chdir(new URL('..', import.meta.url).pathname);
const soft = process.argv.includes('--soft-gl'), only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const copyDir = (a, b) => { mkdirSync(b, { recursive: true }); for (const f of readdirSync(a)) { if (f === 'out' || f === 'assets' || f === 'input') continue; statSync(join(a, f)).isDirectory() ? copyDir(join(a, f), join(b, f)) : copyFileSync(join(a, f), join(b, f)); } };

const REPLAYS = [
  { name: 'butterfly-too-small', project: 'umbrella', why: 'round 0, umbrella pass 4: the butterfly was ≈40 px and its read was missed',
    edits: [["butterfly(fx, fy, 1.8, t, t >= BFLY); focus('butterfly', fx, fy, 64 * 1.8, 46 * 1.8);", "butterfly(fx, fy, .9, t, t >= BFLY); focus('butterfly', fx, fy, 64 * .9, 46 * .9);"]],
    expect: { cls: 'R1', re: /butterfly/ } },
  { name: 'jump-cut', project: 'umbrella', why: 'round 0, umbrella pass 3: the cut on action B→C between zoom 1.22 and 1.25 read as a jump cut',
    edits: [["lerp(1.5, 1.65, pin)", "lerp(1.25, 1.4, pin)"], ["camBegin(lerp(2650, 2700, pin) + sx, lerp(650, 690, pin) + sy", "camBegin(lerp(2620, 2700, pin) + sx, lerp(600, 640, pin) + sy"]],
    expect: { cls: 'R4', re: /jump-cut/ } },
  { name: 'leaf-pops-in', project: 'umbrella', why: 'round 0, umbrella pass 5: the leaf appeared from nowhere after the A→B whip pan',
    edits: [["    if (lt < UP) { leafDome(760, WALK - 8, 95, .12, 'leafA'); focus('leaf', 760, WALK - 30, 190, 60, { min: 40 }); }\n", "    if (false) {}\n"],
            ["    else if (gk < 1) {", "    else if (false) {"], ["    else { const c = leafUmbrella(hx, hy, 10, 220, -40, 'leafA');", "    else if (false) { const c = leafUmbrella(hx, hy, 10, 220, -40, 'leafA');"]],
    expect: { cls: 'R3', re: /held prop "leaf"/ } },
  { name: 'last-star-out-of-frame', project: 'upgrade', why: 'round 0, upgrade pass 1: the push-in left the last star out of frame during its read',
    edits: [["camBegin(X + 60 * pin, lerp(560, 640, pin), lerp(.95, 1.25, pin));", "camBegin(X, lerp(560, 760, pin), lerp(.95, 1.5, pin));"],
            ["focus('lastStar', X + 220, CEIL - 50, 70, 70, { min: 40 });", "focus('lastStar', X + 260, CEIL - 120, 70, 70, { min: 40 });"]],
    expect: { cls: 'R2', re: /lastStar/ } },
  { name: 'touched-star-too-small', project: 'upgrade', why: 'round 0, upgrade pass 4: the star Clawd touches was too small to read',
    edits: [["sr = 30 + 46 * backOut(sk) * (1 - .5 * sk);", "sr = 16 + 30 * backOut(sk) * (1 - .6 * sk);"]],
    expect: { cls: 'R1', re: /"star"/ } },
  { name: 'emote-double-take', project: 'p1-media', why: 'round 0, p1-media seam strip: the emotion timeline restarted at the cut and the "!" popped twice',
    edits: [["const mood = emotions(t, [[2.05, 'surprised', { lookX: .9, view: 'q' }],", "const mood = emotions(t, [[2.5, 'surprised', { lookX: .9, view: 'q' }],"]],
    expect: { cls: 'R3', re: /emotions\(\) timeline/ } },
  { name: 'drawer-behind-clawd', project: 'keys', why: 'RSI round 1, keys sheet 1: Clawd stood in front of the drawer during "things fly out" (found by eye; R6 added)',
    edits: [["[DRAWER - .3, 930], [CUSHION - .4, 930]", "[DRAWER - .3, 1250], [CUSHION - .4, 1250]"]],
    expect: { cls: 'R6', re: /"drawer" is \d+% behind/ } },
];

let fails = 0;
for (const [k, R] of REPLAYS.entries()) {
  if (only.length && !only.includes(R.name)) continue;
  const name = `_rp${k}-${R.name}`, P = join('projects', name);
  copyDir(join('projects', R.project), P);
  try {
    const sceneDir = join(P, 'scenes'), file = join(sceneDir, readdirSync(sceneDir).find(f => R.project === 'p1-media' ? f === 'button.js' : f === 'main.js'));
    let src = readFileSync(file, 'utf8');
    for (const [a, b] of R.edits) { if (!src.includes(a)) throw new Error(`replay ${R.name}: edit target not found: ${a.slice(0, 60)}`); src = src.replace(a, b); }
    writeFileSync(file, src);
    // the copy's project.js may point at the original's audio: irrelevant for reads
    const { browser, page, errors } = await openStudio(name, { softGl: soft, medium: 'flat', scale: .5 });
    const res = await readsCheck(page, P); await browser.close();
    const hit = res.issues.filter(i => i.cls === R.expect.cls && R.expect.re.test(i.msg));
    console.log(`${hit.length ? 'PASS' : 'FAIL'}  ${R.name}  (${R.why})${hit.length ? '\n      → ' + hit[0].msg.slice(0, 140) : '\n      issues: ' + JSON.stringify(res.issues.map(i => i.cls + ' ' + i.msg.slice(0, 80))) + (errors.length ? ' page errors: ' + errors.join(' | ') : '')}`);
    if (!hit.length) fails++;
  } finally { rmSync(P, { recursive: true, force: true }); }
}
console.log(fails ? `\n${fails} replay(s) NOT caught` : '\nALL REPLAYED FAILURES CAUGHT'); process.exit(fails ? 1 : 0);
