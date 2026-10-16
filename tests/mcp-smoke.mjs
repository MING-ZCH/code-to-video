// tests/mcp-smoke.mjs: talk to mcp/c2v-mcp.mjs over stdio like an MCP client: initialize → tools/list → c2v_projects →
// c2v_check → c2v_reads → c2v_sheet (image). Exit 1 if any step fails.  C2V_SOFT_GL=1 node tests/mcp-smoke.mjs [project]
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
process.chdir(new URL('..', import.meta.url).pathname);
const project = process.argv[2] || 'p1-media';
const srv = spawn(process.execPath, ['mcp/c2v-mcp.mjs'], { env: process.env }), rl = createInterface({ input: srv.stdout }), wait = new Map();
rl.on('line', l => { const m = JSON.parse(l); wait.get(m.id)?.(m); });
let id = 0; const call = (method, params) => new Promise(r => { const i = ++id; wait.set(i, r); srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n'); });
let fails = 0; const ok = (c, what, got = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${what}${got ? '  → ' + got : ''}`); if (!c) fails++; };
const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
ok(init.result?.serverInfo?.name === 'c2v', 'initialize', init.result?.protocolVersion);
srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
const list = await call('tools/list', {}); const names = list.result.tools.map(t => t.name);
ok(names.length >= 10 && names.includes('c2v_reads') && names.includes('c2v_sheet'), 'tools/list', names.join(' '));
const pr = await call('tools/call', { name: 'c2v_projects', arguments: {} }); ok(pr.result.content[0].text.includes(project), 'c2v_projects lists the project');
const ch = await call('tools/call', { name: 'c2v_check', arguments: { project } }); ok(/0 error/.test(ch.result.content[0].text), 'c2v_check', ch.result.content[0].text.split('\n').find(l => l.includes('error')));
const rd = await call('tools/call', { name: 'c2v_reads', arguments: { project } }); ok(/c2v reads/.test(rd.result.content[0].text), 'c2v_reads', rd.result.content[0].text.split('\n').slice(-1)[0]);
const sh = await call('tools/call', { name: 'c2v_sheet', arguments: { project, times: [1, 3], medium: 'flat', scale: .5 } });
const img = sh.result.content.find(c => c.type === 'image'); ok(img && img.data.length > 1000, 'c2v_sheet returns an image', img ? `${Math.round(img.data.length / 1024)} KB base64` : JSON.stringify(sh.result));
const bad = await call('tools/call', { name: 'c2v_check', arguments: { project: '../etc' } }); ok(bad.result.isError, 'rejects a path-like project name');
srv.kill(); console.log(fails ? `\n${fails} FAILED` : '\nMCP SMOKE PASS'); process.exit(fails ? 1 : 0);
