// cost.mjs: `c2v cost` — where the render time goes (RSI round 1: a 10 s piece rendered at 55 s/frame on the VM and the
// fix had to be found by hand). Times one frame per shot (second render, after warm-up) at the given medium/scale, flags
// shots that are far slower than the rest, and with --skip=a,b re-times the slowest shot with each part skipped (the scene
// tags parts with `if (!skipped('a')) …`).
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome, gpuFlags, baseFlags } from './chrome.mjs';

export async function costCheck(project, o = {}) {
  const b = await puppeteer.launch({ executablePath: findChrome(o.chrome), headless: true, protocolTimeout: 0, args: [...baseFlags(), ...gpuFlags({ softGl: o.softGl })] });
  const open = async skip => { const p = await b.newPage(); await p.goto(pathToFileURL(resolve('studio.html')).href + `?render&project=${project}&scale=${o.scale || .5}&medium=${o.medium || 'brush'}${skip ? '&skip=' + skip : ''}`, { waitUntil: 'networkidle0', timeout: 120000 }); await p.waitForFunction('window.ready === true', { timeout: 120000 }); return p; };
  const time = async (p, t) => { await p.evaluate(t => window.renderAt(t, 'image/jpeg', .9), t); const t0 = Date.now(); await p.evaluate(t => window.renderAt(t, 'image/jpeg', .9), t); return Date.now() - t0; };
  const page = await open(''), shots = await page.evaluate(() => SHOTS.map(([t0, fn], i, a) => ({ name: fn.name || `shot${i}`, t0, t1: i + 1 < a.length ? a[i + 1][0] : DUR })));
  for (const s of shots) { s.t = +((s.t0 + s.t1) / 2).toFixed(2); s.ms = await time(page, s.t); s.fill = Math.round((await page.evaluate(t => window.inspectAt(t), s.t)).fillArea / (1920 * 1080) * 10) / 10; }
  await page.close();
  const med = [...shots].map(s => s.ms).sort((a, b) => a - b)[Math.floor(shots.length / 2)], slow = shots.reduce((a, s) => s.ms > a.ms ? s : a, shots[0]);
  const issues = shots.filter(s => s.ms > 2.2 * med && s.ms > 3000).map(s => ({ sev: 'warn', cls: 'R5', shot: s.name, msg: `${s.name} costs ${s.ms} ms/frame, ${(s.ms / med).toFixed(1)}× the median shot (${med} ms): profile it with --skip=<parts> (scene: if (!skipped('part')) …); small/background characters → clawd({ lite: true })` }));
  const skips = [];
  for (const k of (o.skip ? String(o.skip).split(',') : [])) { const p = await open(k); skips.push({ skip: k, ms: await time(p, slow.t) }); await p.close(); }
  await b.close();
  return { shots, median: med, slowest: slow.name, skips: skips.map(x => ({ ...x, saves: slow.ms - x.ms })), issues };
}
