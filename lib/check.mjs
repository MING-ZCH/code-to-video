// check.mjs: the machine-checkable part of ANIMATION_GUIDE.md, for one project. Two layers:
//   static   scene sources: determinism hazards, plain p5 shapes, 3D, text calls, Web Audio, outer mutable state
//   runtime  the loaded page: shot list (lengths vs the 1.4–4 s rule, transitions per seam), score events, page errors,
//            storyboard presence and shot count
// Severity: error (breaks determinism or the build) · warn (likely rule break, look at it) · info (counts, for the record).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length));
const RULES = [
  ['error', /\bMath\.random\s*\(/, 'Math.random(): frames must be pure functions of t (use hash(i) / jit())'],
  ['error', /\b(Date\.now|new Date|performance\.now)\s*\(/, 'wall-clock time in a scene: derive everything from t'],
  ['error', /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/, 'timers in a scene: frames are rendered out of order'],
  ['error', /\b(AudioContext|OfflineAudioContext|BiquadFilterNode)\b/, 'Web Audio in a scene: use sound([...]) (engine/audio.js is deterministic, Web Audio filters are not)'],
  ['warn', /(?<![\w.$])(rect|ellipse|circle|triangle|quad|arc|line|point|bezier|background|text)\s*\(/, 'plain p5 shape/text call: paint with paint()/inkLine() (rule 1) or letter() (rule 2)'],
  ['warn', /(?<![\w.$'"])(fill|stroke|noStroke|noFill)\s*\(/, 'plain p5 fill/stroke: colours go through paint() options'],
  ['warn', /\b(rotateX|rotateY|perspective|ortho|box|sphere|torus|cylinder|cone)\s*\(/, '3D call: everything is flat 2D (rule 1)'],
];

export function staticCheck(pdir, scenes) {
  const issues = [], texts = [];
  for (const f of scenes) {
    const path = join(pdir, 'scenes', f); if (!existsSync(path)) { issues.push({ sev: 'error', file: f, line: 0, msg: 'scene file listed in PROJECT.scenes is missing' }); continue; }
    const raw = readFileSync(path, 'utf8'), src = stripComments(raw), lines = src.split('\n');
    lines.forEach((l, i) => {
      for (const [sev, re, msg] of RULES) if (re.test(l)) issues.push({ sev, file: f, line: i + 1, msg, code: raw.split('\n')[i].trim().slice(0, 120) });
      const m = l.match(/\b(letter|sfx)\s*\(\s*(['"`])(.*?)\2/); if (m) texts.push({ file: f, line: i + 1, fn: m[1], text: m[3] });
    });
    // outer mutable state: `let` at IIFE top level (2-space indent) that a function assigns to
    const outerLets = [...src.matchAll(/^ {2}let\s+([\w$,\s=.\d'"\[\]{}-]+?);/gm)].flatMap(m => m[1].split(',').map(v => v.split('=')[0].trim()).filter(Boolean));
    for (const v of outerLets) {
      const re = new RegExp(`(?<![\\w.$])${v.replace('$', '\\$')}\\s*(\\+\\+|--|[+\\-*/]?=(?!=))`, 'g'); let hit = 0;
      lines.forEach((l, i) => { if (/^ {4,}/.test(l) && re.test(l)) { hit++; if (hit === 1) issues.push({ sev: 'error', file: f, line: i + 1, msg: `outer variable "${v}" is assigned inside a function: state carried between frames` }); } re.lastIndex = 0; });
    }
  }
  if (texts.length) issues.push({ sev: texts.length > 3 ? 'warn' : 'info', file: '*', line: 0, msg: `${texts.length} lettering call(s) (rule 2 allows one or two words, once): ${texts.map(t => `"${t.text}"`).join(', ')}` });
  return { issues, texts };
}

// Transitions are judged per seam. A seam (into the first shot, between shots, out of the last) is covered when the shot
// before it has an OUT transition, the shot after it has an IN transition, or either says so in a comment
// ("transition: cut on action" / "smash cut" / "match cut"). IN = a transition call on a line that tests `lt <`;
// OUT = one on a line that tests `lt >` / `dur - lt` / `dur -`. fn.toString() keeps comments, so annotations count.
export const TCALL = /\b(iris|irisShape|brushWipe|whipPan|flash|stylize|shade\(\s*['"]shockwave|smear|whip|wipe|fade)\b/;
export const lineHas = (src, cond) => src.split('\n').some(l => TCALL.test(l) && cond.test(l));
export const transIn = src => lineHas(src, /\blt\s*<|\blt\s*<=|seg\(\s*lt\s*,\s*0/) || /transition\s*(in)?\s*:/i.test(src);
export const transOut = src => lineHas(src, /\blt\s*>|dur\s*-\s*lt|\bdur\s*-/) || /transition\s*(out)?\s*:/i.test(src);
export const annotated = src => /(cut on action|smash cut|match cut|transition\s*:)/i.test(src);
export async function runtimeCheck(page, pdir) {
  const info = await page.evaluate(() => ({
    dur: DUR, bpm: PROJECT.bpm, medium: typeof MEDIUM !== 'undefined' ? MEDIUM : 'brush', karaoke: !!(PROJECT.karaoke && PROJECT.karaoke.lines),
    shots: SHOTS.map(([t0, fn], i) => ({ t0, name: fn.name || `shot${i}`, src: fn.toString() })),
    score: typeof SCORE !== 'undefined' ? SCORE.map(e => ({ at: e.at, kind: e.kind })) : [], loops: Object.keys(LOOPS),
  }));
  const issues = [], shots = info.shots.map((s, i) => ({ ...s, t1: i + 1 < info.shots.length ? info.shots[i + 1].t0 : info.dur }));
  if (!shots.length) {                                  // nothing registered: a scene file failed to load (see the page errors)
    issues.push({ sev: 'error', file: 'scenes', line: 0, msg: 'no shots registered: a scene file failed to load or never called shots([...]); see the page errors above' });
    return { issues, summary: { duration: info.dur, bpm: info.bpm, medium: info.medium, karaoke: info.karaoke, shots: 0, loops: info.loops, sound_events: info.score.length, shot_len: { min: 0, max: 0, mean: 0 }, shots_1p4_4s: 0 }, shots: [] };
  }
  for (const s of shots) s.len = +(s.t1 - s.t0).toFixed(2);
  // a shot function can be reused for several shots: dedupe the source scan per function
  shots.forEach((s, i) => {
    if (s.len < 1.0) issues.push({ sev: 'warn', file: s.name, line: 0, msg: `shot ${i + 1} "${s.name}" is ${s.len} s: shorter than a read can land (1.4 s floor unless it's a deliberate smash cut)` });
    if (s.len > 6) issues.push({ sev: 'warn', file: s.name, line: 0, msg: `shot ${i + 1} "${s.name}" is ${s.len} s: long; check its reads keep changing (rule 3/4)` });
  });
  for (let i = 0; i <= shots.length; i++) {           // seam i sits before shot i (0 = opening, shots.length = ending)
    const prev = shots[i - 1], next = shots[i], at = next ? next.t0 : info.dur;
    const ok = (prev && (transOut(prev.src) || annotated(prev.src))) || (next && (transIn(next.src) || (i > 0 && annotated(next.src))));
    if (!ok) issues.push({ sev: 'warn', file: next ? next.name : prev.name, line: 0, msg: `seam at ${at} s (${i === 0 ? 'opening' : i === shots.length ? 'ending' : `${prev.name} → ${next.name}`}) has no transition: no OUT in the shot before, no IN in the shot after, no "cut on action"/"transition:" note` });
  }
  for (const e of info.score) if (e.at < 0 || e.at >= info.dur) issues.push({ sev: 'warn', file: 'score', line: 0, msg: `sound event ${e.kind} at ${e.at} s is outside 0–${info.dur} s` });
  const sb = join(pdir, 'STORYBOARD.md');
  if (!existsSync(sb)) issues.push({ sev: 'warn', file: 'STORYBOARD.md', line: 0, msg: 'no storyboard: write it before scene code (rule 7)' });
  else {
    const text = readFileSync(sb, 'utf8'), planned = (text.match(/^\s*[A-Z]\d?\s+\d+(\.\d+)?\s*[–-]\s*\d+(\.\d+)?/gm) || []).length, reads = (text.match(/reads?:/gi) || []).length;
    if (planned && planned !== shots.length) issues.push({ sev: 'info', file: 'STORYBOARD.md', line: 0, msg: `storyboard plans ${planned} shots, the code has ${shots.length}` });
    if (!reads) issues.push({ sev: 'warn', file: 'STORYBOARD.md', line: 0, msg: 'storyboard has no "reads:" timing lines (rule 4)' });
  }
  const lens = shots.map(s => s.len);
  return {
    issues, summary: {
      duration: info.dur, bpm: info.bpm, medium: info.medium, karaoke: info.karaoke, shots: shots.length, loops: info.loops, sound_events: info.score.length,
      shot_len: { min: Math.min(...lens), max: Math.max(...lens), mean: +(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(2) },
      shots_1p4_4s: +(lens.filter(l => l >= 1.4 && l <= 4).length / lens.length).toFixed(2),
    }, shots: shots.map(({ src, ...s }) => s),
  };
}

export function checkMarkdown(name, res) {
  const L = [`# c2v check: ${name}`, '', `- duration ${res.summary.duration} s · ${res.summary.shots} shots · mean ${res.summary.shot_len.mean} s (min ${res.summary.shot_len.min}, max ${res.summary.shot_len.max}) · in 1.4–4 s: ${Math.round(res.summary.shots_1p4_4s * 100)}%`,
    `- medium ${res.summary.medium} · bpm ${res.summary.bpm} · sound events ${res.summary.sound_events} · lyric bar ${res.summary.karaoke ? 'on' : 'off'}`, ''];
  const by = s => res.issues.filter(i => i.sev === s);
  L.push(`**${by('error').length} error · ${by('warn').length} warn · ${by('info').length} info**`, '');
  for (const sev of ['error', 'warn', 'info']) for (const i of by(sev)) L.push(`- [${sev}] ${i.file}${i.line ? ':' + i.line : ''} — ${i.msg}${i.code ? `  \`${i.code}\`` : ''}`);
  L.push('', '| # | shot | t0 | t1 | len |', '|---|---|---|---|---|'); res.shots.forEach((s, i) => L.push(`| ${i + 1} | ${s.name} | ${s.t0} | ${s.t1} | ${s.len} |`));
  return L.join('\n') + '\n';
}
