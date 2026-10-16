// report.mjs: one self-contained-ish HTML page per project (out/report.html): video, storyboard, check results,
// review images, metrics, render log. Images and the video are linked relatively, so keep the out/ folder together.
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// small markdown → HTML: headings, tables, lists, checkboxes, code spans, bold, paragraphs, preformatted shot blocks
export function md(src) {
  const out = [], lines = src.split('\n'); let i = 0;
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  while (i < lines.length) {
    const l = lines[i];
    if (/^#{1,4} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n + 1}>${inline(l.slice(n + 1))}</h${n + 1}>`); i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      out.push('<table>' + rows.filter(r => !/^\|[\s|:-]+\|$/.test(r)).map((r, k) => `<tr>${cells(r).map(c => k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join('')}</tr>`).join('') + '</table>'); continue; }
    if (/^\s*[-*] /.test(l)) { const items = []; while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ''));
      out.push('<ul>' + items.map(t => `<li>${t.startsWith('[ ] ') ? '☐ ' + inline(t.slice(4)) : t.startsWith('[x] ') ? '☑ ' + inline(t.slice(4)) : inline(t)}</li>`).join('') + '</ul>'); continue; }
    if (/^ {2,}\S/.test(l) || /^```/.test(l)) { const block = []; if (/^```/.test(l)) { i++; while (i < lines.length && !/^```/.test(lines[i])) block.push(lines[i++]); i++; } else while (i < lines.length && (/^ {2,}/.test(lines[i]) || (lines[i] === '' && /^ {2,}/.test(lines[i + 1] || '')))) block.push(lines[i++]);
      out.push(`<pre>${esc(block.join('\n'))}</pre>`); continue; }
    if (/^> /.test(l)) { out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`); i++; continue; }
    if (l.trim()) out.push(`<p>${inline(l)}</p>`); i++;
  }
  return out.join('\n');
}
export const CSS = `:root{color-scheme:light}body{font:15px/1.55 -apple-system,"PingFang SC",system-ui,sans-serif;max-width:1180px;margin:24px auto;padding:0 20px;color:#2b2233;background:#faf6ee}
h1{font-size:26px}h2{margin-top:36px;border-bottom:2px solid #e4d9c6;padding-bottom:4px}table{border-collapse:collapse;margin:10px 0}td,th{border:1px solid #ddd2bf;padding:4px 8px;font-size:13px;text-align:left}
th{background:#f1e8d8}pre{background:#f3ece0;padding:10px;overflow:auto;font-size:12.5px}code{background:#f1e8d8;padding:0 3px}img,video{max-width:100%;border:1px solid #ddd2bf;margin:6px 0}
.tag{display:inline-block;padding:1px 8px;border-radius:9px;font-size:12px;margin-right:6px}.error{background:#f6c8c0}.warn{background:#f6e3b0}.info{background:#d9e7f2}.ok{background:#cfe8c8}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}`;

export function writeReport(name) {
  const P = join('projects', name), O = join(P, 'out'), rd = f => existsSync(f) ? readFileSync(f, 'utf8') : null;
  const check = rd(join(O, 'check.json')) && JSON.parse(rd(join(O, 'check.json'))), metrics = rd(join(O, 'metrics.json')) && JSON.parse(rd(join(O, 'metrics.json')));
  const imgs = existsSync(join(O, 'review')) ? readdirSync(join(O, 'review')).filter(f => f.endsWith('.jpg')).sort() : [];
  const log = (rd(join(O, 'render-log.jsonl')) || '').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const H = [`<!doctype html><meta charset="utf-8"><title>${esc(name)} · Code-to-Video</title><style>${CSS}</style>`, `<h1>${esc(name)}</h1>`,
    `<p>Pure-code video: every frame is a function of t, painted by <code>projects/${esc(name)}/scenes/*.js</code>; no video or image generation model is used.</p>`];
  if (existsSync(join(O, 'video.mp4'))) H.push('<h2>Video</h2><video src="video.mp4" controls preload="metadata"></video>');
  if (check) {
    const c = s => check.issues.filter(i => i.sev === s).length;
    H.push('<h2>Checks</h2>', `<p><span class="tag ${c('error') ? 'error' : 'ok'}">${c('error')} error</span><span class="tag warn">${c('warn')} warn</span><span class="tag info">${c('info')} info</span> · ${check.summary.shots} shots · mean ${check.summary.shot_len.mean} s · in 1.4–4 s ${Math.round(check.summary.shots_1p4_4s * 100)}% · sound events ${check.summary.sound_events}</p>`,
      '<ul>' + check.issues.map(i => `<li><span class="tag ${i.sev}">${i.sev}</span>${esc(i.file)}${i.line ? ':' + i.line : ''} — ${esc(i.msg)}</li>`).join('') + '</ul>');
  }
  if (metrics) H.push('<h2>Metrics</h2>', md(['| metric | value |', '|---|---|', ...Object.entries(metrics[0]).filter(([k]) => k !== 'cut_times_s').map(([k, v]) => `| ${k} | ${typeof v === 'object' ? JSON.stringify(v) : v} |`)].join('\n')));
  const sb = rd(join(P, 'STORYBOARD.md')); if (sb) H.push('<h2>Storyboard</h2>', md(sb));
  if (imgs.length) H.push('<h2>Review frames</h2>', ...imgs.map(f => `<p><b>${esc(f)}</b><br><img src="review/${esc(f)}" loading="lazy"></p>`));
  const rv = rd(join(O, 'review', 'REVIEW.md')); if (rv) H.push('<h2>Review notes</h2>', md(rv));
  if (log.length) H.push('<h2>Render log</h2>', md(['| at | cmd | frames | ms/frame | gpu |', '|---|---|---|---|---|', ...log.slice(-30).map(r => `| ${r.at.slice(0, 19)} | ${r.cmd} | ${r.frames ?? r.times?.length ?? r.times ?? ''} | ${r.ms_per_frame ?? r.ms_per_frame_effective ?? ''} | ${(r.gpu || '').slice(0, 40)} |`)].join('\n')));
  const out = join(O, 'report.html'); writeFileSync(out, H.join('\n')); return out;
}
