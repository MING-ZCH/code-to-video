#!/usr/bin/env node
// c2v-mcp.mjs: a Model Context Protocol server (stdio, JSON-RPC 2.0, one message per line) exposing the Code-to-Video
// toolchain as tools, so an agent calls them directly and gets images back instead of shelling out and reading files.
//
//   claude_desktop_config.json → "mcpServers": { "c2v": { "command": "node", "args": ["<repo>/mcp/c2v-mcp.mjs"] } }
//   env C2V_SOFT_GL=1 on GPU-less Linux (software WebGL; set LD_LIBRARY_PATH as scripts/vm-c2v.sh does)
//
// Tools: c2v_projects, c2v_new, c2v_check, c2v_reads, c2v_cost, c2v_sheet, c2v_strip, c2v_selftest, c2v_metrics, c2v_render, c2v_guide
// No dependencies beyond the repo itself (no MCP SDK needed for stdio).
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOFT = process.env.C2V_SOFT_GL === '1' ? ['--soft-gl'] : [];
const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const run = (args, timeoutMs = 600000) => new Promise(res => {
  const p = spawn(process.execPath, args, { cwd: ROOT, env: process.env }); let out = '', err = '';
  const timer = setTimeout(() => { p.kill('SIGTERM'); err += `\n(timed out after ${timeoutMs / 1000} s; re-run to resume where it applies)`; }, timeoutMs);
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('close', code => { clearTimeout(timer); res({ code, out, err }); });
});
const text = t => ({ type: 'text', text: t });
const image = f => ({ type: 'image', mimeType: 'image/jpeg', data: readFileSync(f).toString('base64') });
const proj = a => { if (!a.project || !/^[\w.-]+$/.test(a.project)) throw new Error('project: a project folder name under projects/'); return a.project; };
const media = a => [...(a.medium ? [`--medium=${a.medium}`] : []), ...(a.scale ? [`--scale=${a.scale}`] : [])];

const TOOLS = {
  c2v_projects: { description: 'List the projects (projects/<name>) with duration, shot count and whether a video exists.', inputSchema: { type: 'object', properties: {} },
    async run() {
      const rows = readdirSync(join(ROOT, 'projects')).filter(n => existsSync(join(ROOT, 'projects', n, 'project.js'))).map(n => {
        const c = existsSync(join(ROOT, 'projects', n, 'out/check.json')) ? JSON.parse(readFileSync(join(ROOT, 'projects', n, 'out/check.json'), 'utf8')).summary : null;
        return `${n}: ${c ? `${c.duration} s, ${c.shots} shots` : 'not checked'}${existsSync(join(ROOT, 'projects', n, 'out/video.mp4')) ? ', video ✓' : ''}`; });
      return [text(rows.join('\n'))]; } },
  c2v_guide: { description: 'Return ANIMATION_GUIDE.md (the rules and API every scene must follow). Read it before writing scene code.', inputSchema: { type: 'object', properties: {} },
    async run() { return [text(readFileSync(join(ROOT, 'ANIMATION_GUIDE.md'), 'utf8'))]; } },
  c2v_new: { description: 'Create projects/<project> from an input file (lyrics .lrc/.srt, script .md/.txt, image, audio, video): writes input/brief.md, project.js, a STORYBOARD.md template and a placeholder scene.',
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' }, from: { type: 'string', description: 'absolute path of the input file' }, duration: { type: 'number' }, bpm: { type: 'number' }, medium: { type: 'string', enum: ['brush', 'flat'] } } },
    async run(a) { const r = await run(['bin/c2v.mjs', 'new', proj(a), ...(a.from ? [`--from=${a.from}`] : []), ...(a.duration ? [`--duration=${a.duration}`] : []), ...(a.bpm ? [`--bpm=${a.bpm}`] : []), ...(a.medium ? [`--medium=${a.medium}`] : [])]);
      const brief = join(ROOT, 'projects', a.project, 'input/brief.md');
      return [text(r.out + r.err + (existsSync(brief) ? '\n\n' + readFileSync(brief, 'utf8') : ''))]; } },
  c2v_check: { description: 'Rule checks for a project: determinism hazards, plain p5 shapes, 3D, lettering, shot lengths, a transition at every seam, storyboard. Errors must be 0.',
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' } } },
    async run(a) { const r = await run(['bin/c2v.mjs', 'check', proj(a), ...SOFT]); return [text(r.out || r.err)]; } },
  c2v_reads: { description: 'Read checks from focus() declarations: R1 focal element too small at its read, R2 out of frame, R3 seam continuity (held props, emotion re-takes), R4 jump cuts.',
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' } } },
    async run(a) { const r = await run(['bin/c2v.mjs', 'reads', proj(a), ...SOFT]); return [text(r.out || r.err)]; } },
  c2v_sheet: { description: 'Render a contact sheet and return it as an image. times: seconds to sample; omit for first/middle/last of every shot. Use medium "flat" and scale 0.5 for fast structure checks.',
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' }, times: { type: 'array', items: { type: 'number' } }, cols: { type: 'number' }, medium: { type: 'string' }, scale: { type: 'number' },
      crop: { type: 'array', items: { type: 'number' }, description: '[x, y, w, h] in frame pixels' } } },
    async run(a) {
      const out = `projects/${proj(a)}/out/mcp/sheet_${Date.now()}.jpg`;
      if (!a.times) { const r = await run(['bin/c2v.mjs', 'sheet', a.project, ...SOFT, ...media(a)]); const f = join(ROOT, 'projects', a.project, 'out/review/sheet_1.jpg');
        return existsSync(f) ? [text(r.out.split('\n').filter(l => l.includes('jpg')).join('\n')), image(f)] : [text(r.out + r.err)]; }
      const r = await run(['render.mjs', `--project=${a.project}`, ...SOFT, ...media(a), `--sheet=${a.times.join(',')}`, `--cols=${a.cols || Math.min(4, a.times.length)}`, '--w=480', ...(a.crop ? [`--crop=${a.crop.join(',')}`] : []), `--out=${out}`]);
      return existsSync(join(ROOT, out)) ? [text(r.out.trim().split('\n').pop()), image(join(ROOT, out))] : [text(r.out + r.err)]; } },
  c2v_strip: { description: 'Render every frame between from and to (seconds) as one image: for motion, takes, contacts and seams.',
    inputSchema: { type: 'object', required: ['project', 'from', 'to'], properties: { project: { type: 'string' }, from: { type: 'number' }, to: { type: 'number' }, medium: { type: 'string' }, scale: { type: 'number' } } },
    async run(a) { const out = `projects/${proj(a)}/out/mcp/strip_${Date.now()}.jpg`;
      const r = await run(['render.mjs', `--project=${a.project}`, ...SOFT, ...media(a), `--strip=${a.from}:${a.to}`, '--cols=6', '--w=320', `--out=${out}`]);
      return existsSync(join(ROOT, out)) ? [text(r.out.trim().split('\n').pop()), image(join(ROOT, out))] : [text(r.out + r.err)]; } },
  c2v_cost: { description: 'Where render time goes: ms/frame per shot, shots far slower than the rest, and (skip: parts tagged in the scene with skipped("name")) what skipping each part saves.',
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' }, skip: { type: 'array', items: { type: 'string' } }, scale: { type: 'number' }, medium: { type: 'string' } } },
    async run(a) { const r = await run(['bin/c2v.mjs', 'cost', proj(a), ...SOFT, ...media(a), ...(a.skip ? [`--skip=${a.skip.join(',')}`] : [])]); return [text(r.out || r.err)]; } },
  c2v_selftest: { description: 'Determinism: shot midpoints rendered three ways (again, out of order) must give byte-identical PNGs (scale 1).',
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' } } },
    async run(a) { const r = await run(['bin/c2v.mjs', 'selftest', proj(a), ...SOFT]); return [text((r.out + r.err).split('\n').filter(l => /SELFTEST|│/.test(l)).join('\n') || r.out + r.err)]; } },
  c2v_metrics: { description: 'Timing/motion/subtitle metrics of the project video, or of any MP4 path (same definitions as the baselines).',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, file: { type: 'string' } } },
    async run(a) { const r = await run(['bin/c2v.mjs', 'metrics', a.project || 'x', ...(a.file ? [a.file] : [])]); return [text(r.out + r.err)]; } },
  c2v_render: { description: 'Final render: resumable parallel frames → code-generated sound → encode → metrics. Long-running; if it times out, call it again to resume.',
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' }, workers: { type: 'number' }, scale: { type: 'number' }, medium: { type: 'string' }, timeoutSec: { type: 'number' } } },
    async run(a) { const r = await run(['bin/c2v.mjs', 'render', proj(a), `--workers=${a.workers || 4}`, ...SOFT, ...media(a)], (a.timeoutSec || 3000) * 1000);
      return [text((r.out + r.err).split('\n').filter(l => /frames to render|ms\/frame effective|wrote|duration_s|timed out|rror/.test(l)).slice(-12).join('\n'))]; } },
};

const rl = createInterface({ input: process.stdin });
rl.on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  const reply = (result) => m.id !== undefined && send({ jsonrpc: '2.0', id: m.id, result }), fail = (code, message) => m.id !== undefined && send({ jsonrpc: '2.0', id: m.id, error: { code, message } });
  try {
    if (m.method === 'initialize') return reply({ protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'c2v', version: '0.2.0' },
      instructions: 'Code-to-Video toolchain. Read c2v_guide first; storyboard before code; after each shot run c2v_check and c2v_reads, then look at c2v_sheet / c2v_strip images.' });
    if (m.method === 'notifications/initialized' || m.method?.startsWith('notifications/')) return;
    if (m.method === 'ping') return reply({});
    if (m.method === 'tools/list') return reply({ tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) });
    if (m.method === 'tools/call') {
      const t = TOOLS[m.params?.name]; if (!t) return fail(-32602, `unknown tool ${m.params?.name}`);
      try { return reply({ content: await t.run(m.params.arguments || {}) }); } catch (e) { return reply({ content: [text(String(e.message || e))], isError: true }); }
    }
    fail(-32601, `method not found: ${m.method}`);
  } catch (e) { fail(-32603, String(e)); }
});
