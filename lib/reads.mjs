// reads.mjs: `c2v reads` — the failure classes that visual review kept catching (RSI round 1), checked by machine.
// Scenes declare what the viewer must see with focus(id, x, y, w, h, o) / focusClawd(...); this samples every shot
// (start, each storyboard read, end) in the cheap flat medium and reports:
//   R1 size      a declared element smaller than its minimum on screen (default 70 px ≈ 6.5% of the frame height)
//   R2 frame     a declared element mostly (> 30%) or wholly outside the frame at a read
//   R3 seam      across a continuous seam (cut on action / match cut / whip / camera carry): an element that pops in or
//                vanishes; and at any seam an emotions() timeline that starts at the cut (the emote/take re-pops)
//   R6 occluded  a read target more than 40% covered by a character box (focusClawd / { char: true }) — unless the target is
//                drawn over the character ({ front: true } or a held prop) or is a group of characters ({ group: true })
//   R4 jump cut  a continuous seam whose framing changes by < 20% in zoom and < 15% of the frame in centre
// Nothing here replaces looking at frames (c2v-review); it catches the misses that recurred in round 0.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const W = 1920, H = 1080;
function storyboardReads(pdir) {
  const f = join(pdir, 'STORYBOARD.md'); if (!existsSync(f)) return [];
  const out = []; for (const m of readFileSync(f, 'utf8').matchAll(/(?:reads:\s*|^\s{6,})(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s+(.+)$/gm)) out.push([+m[1], +m[2], m[3].trim()]);
  return out;
}
// a seam is continuous when the action or the camera carries across it: a cut on action / match cut / camera carry noted in
// either shot's transition comment, or a whip pan on the OUT of A or the IN of B
const lines = (src, re) => src.split('\n').filter(l => re.test(l)).join('\n');
function isContinuous(a, b) {                        // same space on both sides of the cut (a whip pan goes somewhere new)
  const note = /transition[^\n]*?(cut on action|match cut|carr|pull-back|camera move)/i;
  return note.test(lines(a, /transition\s*(out)?\s*:/i)) || note.test(lines(b, /transition\s*(in)?\s*:/i));
}
// an element is checked during the reads that are about it: the read's text mentions its id (camelCase split) or one of
// its words (focus(..., { words: ['cloud', 'mushroom'] })). Elsewhere it may be off screen or small on purpose.
const wordsOf = F => [F.id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(), ...(F.words || []).map(w => w.toLowerCase())];
const about = (F, text) => text && wordsOf(F).some(w => text.toLowerCase().includes(w));
const inside = ([x, y, w, h]) => { const ix = Math.max(0, Math.min(W, x + w) - Math.max(0, x)), iy = Math.max(0, Math.min(H, y + h) - Math.max(0, y)); return (ix * iy) / Math.max(1, w * h); };

const overlap = (a, b) => { const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])); return ix * iy / Math.max(1, a[2] * a[3]); };

export async function readsCheck(page, pdir) {
  const info = await page.evaluate(() => ({ dur: DUR, shots: SHOTS.map(([t0, fn], i) => ({ t0, name: fn.name || `shot${i}`, src: fn.toString() })) }));
  const shots = info.shots.map((s, i) => ({ ...s, t1: i + 1 < info.shots.length ? info.shots[i + 1].t0 : info.dur }));
  const reads = storyboardReads(pdir), issues = [], samples = [], f = 1 / 24;
  const at = async t => page.evaluate(t => window.inspectAt(t), +t.toFixed(4));
  for (const [i, s] of shots.entries()) {
    const ts = new Map([[s.t0 + f, 'edge'], [s.t1 - f, 'edge']]);           // edges: for seams (transitions live there)
    for (const [a, b] of reads) if (a >= s.t0 - 1e-6 && a < s.t1) ts.set(Math.min(s.t1 - .25, (a + b) / 2), 'read');   // the middle of each read
    for (const [t, kind] of [...ts].sort((a, b) => a[0] - b[0])) {
      const r = await at(t); samples.push({ shot: i, ...r });
      const readNow = kind === 'read' && reads.find(([a, b]) => t >= a && t <= b);
      for (const F of r.focus) {
        if (!readNow || !about(F, readNow[2])) continue;
        const size = Math.max(F.box[2], F.box[3]), frac = inside(F.box);
        if (frac > .2 && size < F.min) issues.push({ sev: 'warn', cls: 'R1', t: +t.toFixed(2), shot: s.name, msg: `"${F.id}" is ${Math.round(size)} px on screen at ${t.toFixed(2)} s (min ${F.min}) during the read "${readNow[2].slice(0, 60)}"` });
        if (!F.char && !F.front) for (const G of r.focus) {
          const member = F.group && overlap(G.box, F.box) >= .6;   // focus(..., { group: true }): a target made of characters; its members don't hide it
          if (!G.char || G.id === F.id || member) continue;
          const c = overlap(F.box, G.box);
          if (c > .4) issues.push({ sev: 'warn', cls: 'R6', t: +t.toFixed(2), shot: s.name, msg: `"${F.id}" is ${Math.round(c * 100)}% behind "${G.id}" at ${t.toFixed(2)} s during the read "${readNow[2].slice(0, 60)}": move the character aside (or mark the element { front: true } if it is drawn over it)` });
        }
        if (!F.offscreenOk && frac < .7) issues.push({ sev: 'warn', cls: 'R2', t: +t.toFixed(2), shot: s.name, msg: `"${F.id}" is ${frac < .01 ? 'out of frame' : `${Math.round((1 - frac) * 100)}% outside the frame`} at ${t.toFixed(2)} s during the read "${readNow[2].slice(0, 60)}"` });
      }
    }
  }
  // seams
  for (let i = 1; i < shots.length; i++) {
    const A = shots[i - 1], B = shots[i], seam = B.t0;
    const continuous = isContinuous(A.src, B.src);
    const a = samples.filter(x => x.shot === i - 1).at(-1), b = samples.find(x => x.shot === i);
    if (!a || !b) continue;
    if (continuous) {
      const ids = x => new Set(x.focus.filter(F => inside(F.box) > .2).map(F => F.id)), ia = ids(a), ib = ids(b);
      const seenBefore = id => samples.some(x => x.shot < i && x.focus.some(F => F.id === id));
      const seenLater = id => samples.some(x => x.shot >= i && x !== b && x.focus.some(F => F.id === id && inside(F.box) > .2));
      for (const id of ib) if (!ia.has(id) && !seenBefore(id) && !b.focus.find(F => F.id === id).held)
        issues.push({ sev: 'warn', cls: 'R3', t: seam, shot: B.name, msg: `"${id}" pops in at the ${seam} s seam (${A.name} → ${B.name}, a continuous transition) without being set up in the shot before` });
      const drawnB = new Set(b.focus.map(F => F.id));   // a vanish = no longer drawn (merely outside a tighter framing is fine)
      for (const id of ia) if (!drawnB.has(id) && seenLater(id))
        issues.push({ sev: 'warn', cls: 'R3', t: seam, shot: B.name, msg: `"${id}" vanishes at the ${seam} s seam and comes back later: continuity break` });
      const ca = a.cams.at(-1), cb = b.cams[0], onAction = /cut on action/i.test(lines(A.src, /transition/i) + lines(B.src, /transition/i));
      if (ca && cb && onAction) {                     // a match cut keeps the framing on purpose; a camera carry is one move
        const zr = Math.max(ca.zoom, cb.zoom) / Math.min(ca.zoom, cb.zoom), d = Math.hypot((ca.cx - cb.cx) * cb.zoom, (ca.cy - cb.cy) * cb.zoom);
        // identical framing (< 2% zoom, < 10 px) is an invisible cut, not a jump
        if (zr < 1.2 && d < .15 * W && !(zr < 1.02 && d < 10)) issues.push({ sev: 'warn', cls: 'R4', t: seam, shot: B.name, msg: `jump-cut risk at ${seam} s: framing changes ${Math.round((zr - 1) * 100)}% in zoom and ${Math.round(d)} px in centre across a cut on action (change one by ≥ 20% / 15% of the frame)` });
      }
    }
    // held props (o.held) travel with their character across ANY seam: one that appears at a cut must have been set up
    { const seenBefore = id => samples.some(x => x.shot < i && x.focus.some(F => F.id === id));
      for (const F of b.focus) if (F.held && !seenBefore(F.id) && inside(F.box) > .2)
        issues.push({ sev: 'warn', cls: 'R3', t: seam, shot: B.name, msg: `held prop "${F.id}" appears at the ${seam} s cut with no set-up before it (plant it in ${A.name}, or show it being picked up)` }); }
    const restart = b.emolog.filter(e => !e.fresh && e.t0 >= seam - 1e-6 && e.t0 <= seam + .3);
    if (restart.length) issues.push({ sev: 'warn', cls: 'R3', t: seam, shot: B.name, msg: `${restart.length} emotions() timeline(s) start at the ${seam} s cut (${restart.map(e => e.first).join(', ')}): the emote/take re-pops. If the character continues, start with the previous shot's last key; if it's new, pass { fresh: true }` });
  }
  const declared = new Set(samples.flatMap(x => x.focus.map(F => F.id)));
  if (!declared.size) issues.push({ sev: 'info', cls: 'R0', t: 0, shot: '*', msg: 'no focus() declarations: R1–R6 have nothing to check. Declare what each read is about (focus / focusClawd).' });
  return { issues, samples: samples.length, declared: [...declared], shots: shots.length };
}
