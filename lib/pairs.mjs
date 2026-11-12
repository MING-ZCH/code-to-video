// pairs.mjs: edit pairs from one program. projects/<p>/pairs.json lists edits as parameter overrides of PROJECT.params;
// each edit renders a target video next to the shared source video, and because frames are pure functions of (t, params)
// every pixel the edit does not touch is identical, so the difference of the two frame sequences is the edit mask.
//
// pairs.json: { "range": "0:10", "scale": .5, "workers": 4, "threshold": 6,
//               "edits": [{ "id": "grade_cool", "type": "color_grade", "zh": "整体改为冷色调", "en": "Make the grade cool.", "params": { "temp": -.35 } }, …] }
//
// Output, projects/<p>/out/pairs/: source.mp4, <id>.mp4, <id>_mask.mp4 (white = changed, at JPEG-block precision),
// <id>_sheet.jpg (source / target / mask at three times) and pairs.jsonl (one line per edit, both directions derivable).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

const node = (args) => { const r = spawnSync(process.execPath, args, { stdio: 'inherit' }); if (r.status) throw new Error('render.mjs ' + args.join(' ') + ' failed'); };
const ff = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 28 }); if (r.status) throw new Error(String(r.stderr)); return r; };

function renderVariant(name, outDir, params, cfg) {
  const base = ['render.mjs', `--project=${name}`, `--out-dir=${outDir}`, `--params=${JSON.stringify(params)}`, ...(cfg.scale ? [`--scale=${cfg.scale}`] : [])];
  if (cfg.force) rmSync(outDir, { recursive: true, force: true });
  node([...base, '--frames', `--range=${cfg.range}`, `--workers=${cfg.workers}`]);       // resumable: only missing frames render
  if (!existsSync(join(outDir, 'video.mp4'))) node([...base, '--encode', `--out=${join(outDir, 'video.mp4')}`]);
}

// mask = per-pixel max channel difference > threshold; ratio = mean of the mask per frame (lavfi signalstats on the mask)
function maskOf(srcFrames, dstFrames, out, start, cfg) {
  const ratioFile = out.replace(/\.mp4$/, '.ratio.txt');
  ff(['-framerate', '24', '-start_number', String(start), '-i', join(srcFrames, 'f%05d.jpg'), '-framerate', '24', '-start_number', String(start), '-i', join(dstFrames, 'f%05d.jpg'),
    '-filter_complex', `[0:v]format=gbrp[a];[1:v]format=gbrp[b];[a][b]blend=all_mode=difference,extractplanes=r+g+b[r][g][bb];[r][g]blend=all_mode=lighten[rg];[rg][bb]blend=all_mode=lighten,lut=y='if(gt(val,${cfg.threshold}),255,0)',split[m][s];[s]signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${ratioFile.replace(/:/g, '\\:')}[n]`,
    '-map', '[m]', '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', out, '-map', '[n]', '-f', 'null', '-']);
  const ys = readFileSync(ratioFile, 'utf8').split('\n').filter(l => l.includes('YAVG')).map(l => +l.split('=')[1] / 255);
  rmSync(ratioFile);
  return { mean: ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length), max: Math.max(0, ...ys), frames: ys.length, changedFrames: ys.filter(y => y > .001).length, ratios: ys };
}

function sheet(dir, id, times) {
  const tiles = [];
  for (const [k, v] of [['source', 'source/video.mp4'], ['target', `${id}/video.mp4`], ['mask', `${id}_mask.mp4`]])
    times.forEach((t, j) => { const f = join(dir, `_t_${k}_${j}.jpg`); ff(['-ss', String(t), '-i', join(dir, v), '-frames:v', '1', '-vf', 'scale=480:-2', f]); tiles.push(f); });
  const n = times.length, inputs = tiles.flatMap(f => ['-i', f]);
  ff([...inputs, '-filter_complex', `${tiles.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${tiles.length}:layout=${tiles.map((_, i) => `${(i % n) * 480}_${Math.floor(i / n) * 270}`).join('|')}`, join(dir, `${id}_sheet.jpg`)]);
  tiles.forEach(f => rmSync(f));
}

// ---------- sweeps: many single-parameter edits from a declared space ----------
// "sweep": { "n": 24, "seed": 1, "space": { "<param>": { "values": [...] } | { "range": [lo, hi], "step": s } },
//            "templates": { "<param>": { "type": "...", "zh": "…{v}…", "en": "…{v}…", "names": { "<value>": ["中文", "English"] } } } }
// Each generated edit changes exactly one parameter away from its default (PROJECT.params), so its instruction is exact.
function lcgRand(seed) { let s = (seed >>> 0) || 1; return () => ((s = Math.imul(s, 1664525) + 1013904223 >>> 0) / 4294967296); }
function sweepEdits(sweep, defaults, manual = []) {
  const rnd = lcgRand(sweep.seed ?? 1), keys = Object.keys(sweep.space), out = [], seen = new Set(manual.map(e => JSON.stringify(e.params)));
  const tag = v => { const s = String(v).replace(/[^\w.-]+/g, '').replace(/\./g, 'p'); return s && s === String(v).replace(/\./g, 'p') ? s : createHash('sha1').update(String(v)).digest('hex').slice(0, 6); };
  const fmt = (k, v, lang) => { const n = sweep.templates[k]?.names?.[String(v)]; return n ? n[lang === 'zh' ? 0 : 1] : typeof v === 'number' ? String(+v.toFixed(3)) : String(v); };
  for (let tries = 0; out.length < (sweep.n ?? 12) && tries < (sweep.n ?? 12) * 20; tries++) {
    const k = keys[Math.floor(rnd() * keys.length)], sp = sweep.space[k];
    const v = sp.values ? sp.values[Math.floor(rnd() * sp.values.length)] : +(sp.range[0] + Math.round(rnd() * (sp.range[1] - sp.range[0]) / sp.step) * sp.step).toFixed(6);
    const id = `sw_${k}_${tag(v)}`, key = JSON.stringify({ [k]: v });
    if (JSON.stringify(v) === JSON.stringify(defaults[k]) || seen.has(key)) continue;
    seen.add(key);
    const t = sweep.templates[k] || { type: k, zh: `把 ${k} 改为 {v}。`, en: `Set ${k} to {v}.` };
    out.push({ id, type: t.type || k, zh: t.zh.replace('{v}', fmt(k, v, 'zh')), en: t.en.replace('{v}', fmt(k, v, 'en')), params: { [k]: v }, generated: true });
  }
  return out;
}
function projectDefaults(pdir) {
  const src = readFileSync(join(pdir, 'project.js'), 'utf8'), PROJECT = new Function(src + '; return PROJECT;')();
  return PROJECT.params || {};
}

// ---------- dataset export: keyframe triplets (source / target / mask) at frames the edit changed ----------
function exportKeyframes(dir, e, start, ratios, k, out) {
  const changed = ratios.map((r, i) => [r, i]).filter(([r]) => r > .001).map(([, i]) => i);
  if (!changed.length) return [];
  const picks = [...new Set(Array.from({ length: Math.min(k, changed.length) }, (_, j) => changed[Math.round(j * (changed.length - 1) / Math.max(1, k - 1))]))];
  mkdirSync(join(out, e.id), { recursive: true });
  return picks.map(i => {
    const f = `f${String(start + i).padStart(5, '0')}.jpg`, base = join(out, e.id, `k${String(i).padStart(4, '0')}`);
    for (const [src, tag] of [[join(dir, 'source', 'frames', f), 'source'], [join(dir, e.id, 'frames', f), 'target']]) ff(['-i', src, '-q:v', '2', `${base}_${tag}.jpg`]);
    ff(['-i', join(dir, `${e.id}_mask.mp4`), '-vf', `select=eq(n\\,${i})`, '-frames:v', '1', `${base}_mask.png`]);
    return { frame: start + i, t: +((start + i) / 24).toFixed(3), source: `${e.id}/${basename(base)}_source.jpg`, target: `${e.id}/${basename(base)}_target.jpg`, mask: `${e.id}/${basename(base)}_mask.png`, changed_ratio: +ratios[i].toFixed(4) };
  });
}

export async function runPairs(name, opt = {}) {
  const pdir = join('projects', name), spec = JSON.parse(readFileSync(join(pdir, 'pairs.json'), 'utf8'));
  if (spec.sweep) spec.edits = [...spec.edits, ...sweepEdits(spec.sweep, projectDefaults(pdir), spec.edits)];
  const cfg = { range: opt.range || spec.range || '0:' + (opt.dur || 10), scale: opt.scale ?? spec.scale, workers: +(opt.workers || spec.workers || 4), threshold: +(opt.threshold || spec.threshold || 6), force: !!opt.force };
  const dir = join(pdir, 'out', 'pairs'); mkdirSync(dir, { recursive: true });
  const only = opt.only ? String(opt.only).split(',') : null, edits = spec.edits.filter(e => !only || only.includes(e.id));
  if (opt.list) { for (const e of edits) console.log(`${e.id.padEnd(28)} ${String(e.type).padEnd(12)} ${JSON.stringify(e.params).padEnd(34)} ${e.zh}`); return edits; }
  const start = Math.round(+cfg.range.split(':')[0] * 24);
  console.log(`pairs: ${name} · ${edits.length} edits · range ${cfg.range} · scale ${cfg.scale ?? 1}`);
  renderVariant(name, join(dir, 'source'), {}, cfg);
  const rows = [];
  for (const e of edits) {
    renderVariant(name, join(dir, e.id), e.params, cfg);
    const m = maskOf(join(dir, 'source', 'frames'), join(dir, e.id, 'frames'), join(dir, `${e.id}_mask.mp4`), start, cfg);
    const [a, b] = cfg.range.split(':').map(Number), times = e.sheet || [a + (b - a) * .2, a + (b - a) * .5, a + (b - a) * .85];
    sheet(dir, e.id, times.map(t => t - a));
    const row = { id: e.id, edit_type: e.type, instruction_zh: e.zh, instruction_en: e.en, source: 'source/video.mp4', target: `${e.id}/video.mp4`, mask: `${e.id}_mask.mp4`,
      params_source: {}, params_target: e.params, generated: !!e.generated, range_s: cfg.range, frames: m.frames, changed_frames: m.changedFrames, changed_ratio_mean: +m.mean.toFixed(4), changed_ratio_max: +m.max.toFixed(4) };
    if (opt.export) row.keyframes = exportKeyframes(dir, e, start, m.ratios, +(opt.keyframes || 4), join(dir, 'keyframes'));
    rows.push(row);
    console.log(`  ${e.id.padEnd(16)} ${e.type.padEnd(14)} changed frames ${m.changedFrames}/${m.frames} · mean area ${(m.mean * 100).toFixed(1)}% · max ${(m.max * 100).toFixed(1)}%`);
  }
  // keep the per-variant frames only on request: they are the mask's exact source but large
  if (!opt['keep-frames']) for (const d of ['source', ...edits.map(e => e.id)]) if (existsSync(join(dir, d, 'frames'))) rmSync(join(dir, d, 'frames'), { recursive: true });
  const prev = existsSync(join(dir, 'pairs.jsonl')) ? readFileSync(join(dir, 'pairs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => !rows.some(x => x.id === r.id)) : [];
  writeFileSync(join(dir, 'pairs.jsonl'), [...prev, ...rows].map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(`wrote ${join(dir, 'pairs.jsonl')} (${prev.length + rows.length} pairs)`);
  return rows;
}
