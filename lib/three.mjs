// three.mjs: render a glTF scene with three.js in headless Chrome (engine/three.js): rasterised, rasterised + GTAO, or
// path traced. Used to compare JS renderers with Blender on the same exported scene.
//
//   c2v three --glb=<scene.glb> --hdr=<env.hdr> --mode=raster|raster_gtao|pt [--spp=256] [--bounces=8] [--w=1280 --h=720] --out=<file.png>
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, dirname, sep } from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome, baseFlags, gpuFlags } from './chrome.mjs';

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };

/** Serve the engine page, three.js packages under node_modules, and two named data files; nothing else. */
function serve(files) {
  const roots = ['engine', 'node_modules/three', 'node_modules/three-mesh-bvh', 'node_modules/three-gpu-pathtracer', 'node_modules/@dimforge/rapier3d-deterministic-compat'].map(r => resolve(r) + sep);
  const named = new Map(Object.entries(files));
  const srv = createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { rel = ''; }
    let f = named.get(rel);
    if (!f) { const p = resolve('.' + rel); f = roots.some(r => p.startsWith(r)) ? p : null; }
    if (!f || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Content-Length': statSync(f).size });
    createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, port: srv.address().port })));
}

export async function renderThree({ glb, hdr, mode, spp = 256, bounces = 8, w = 1280, h = 720, out, bg = true, envRot = 0 }) {
  const { srv, port } = await serve({ '/scene.glb': resolve(glb), '/env.hdr': resolve(hdr) });
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, protocolTimeout: 1800000, args: [...baseFlags(), ...gpuFlags({})] });
  try {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/engine/three.html`);
    await page.waitForFunction(() => window.C2V3, { timeout: 60000 }).catch(() => { throw new Error('page did not load: ' + errs.join(' | ')); });
    const info = await page.evaluate(o => window.C2V3.init(o), { glb: '/scene.glb', hdr: '/env.hdr', w, h, bg, envRot });
    const r = await page.evaluate(o => window.C2V3.render(o), { mode, spp, bounces });
    const url = await page.evaluate(() => window.C2V3.png());
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (errs.length) console.warn('page errors:', errs.slice(0, 3).join(' | '));
    return { ...info, ...r, out };
  } finally { await browser.close().catch(() => {}); srv.close(); }
}

/** Open the page on a scene and return world bounding boxes of named nodes (three.js Y-up). */
export async function probeThree({ glb, hdr, names, w = 640, h = 360 }) {
  const { srv, port } = await serve({ '/scene.glb': resolve(glb), '/env.hdr': resolve(hdr) });
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: [...baseFlags(), ...gpuFlags({})] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/engine/three.html`); await page.waitForFunction(() => window.C2V3);
    await page.evaluate(o => window.C2V3.init(o), { glb: '/scene.glb', hdr: '/env.hdr', w, h });
    return await page.evaluate(ns => Object.fromEntries(ns.map(n => [n, window.C2V3.where(n)])), names);
  } finally { await browser.close().catch(() => {}); srv.close(); }
}

/** Render a scene module's rigid-body shot (engine/three.js simInit/simStep) into projects/<p>/assets/<as>/ and lock it. */
export async function renderSimLayer(pdir, sceneFile, opt) {
  const { pathToFileURL } = await import('node:url');
  const { createHash } = await import('node:crypto');
  const { readFileSync } = await import('node:fs');
  const { readLock, writeLockPublic } = await import('./assets.mjs');
  const mod = await import(pathToFileURL(resolve(sceneFile)).href);
  const params = { ...(mod.PARAMS || {}), ...JSON.parse(opt.params || '{}') };
  const sc = +(opt.scale || 1), w = Math.round(1920 * sc), h = Math.round(1080 * sc), fps = +(opt.fps || 24), frames = +(opt.frames || 96);
  const cfg = mod.sim({ params, P: k => params[k], pdir, w, h, fps, frames });
  const { srv, port } = await serve({ '/scene.glb': cfg.glb, '/env.hdr': cfg.hdr });
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, protocolTimeout: 1800000, args: [...baseFlags(), ...gpuFlags({})] });
  const dir = resolve(pdir, 'assets', opt.as); mkdirSync(dir, { recursive: true });
  const per = []; const t0 = Date.now();
  try {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/engine/three.html`); await page.waitForFunction(() => window.C2V3);
    await page.evaluate(o => window.C2V3.init(o), { glb: '/scene.glb', hdr: '/env.hdr', w, h });
    const info = await page.evaluate(o => window.C2V3.simInit(o), { dynamic: cfg.dynamic, drop: cfg.drop, mode: cfg.mode, fps, dur: frames / fps });
    for (let f = 0; f < frames; f++) {
      per.push(await page.evaluate(() => window.C2V3.simStep()));
      const url = await page.evaluate(() => window.C2V3.jpg(0.92));
      writeFileSync(resolve(dir, `f${String(f + 1).padStart(5, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    }
    if (errs.length) throw new Error(errs.join(' | '));
    const depth = per.map(r => r.depth_mm), measure = { mode: cfg.mode, colliders: info, max_penetration_mm: Math.max(...depth),
      frames_over_1mm: depth.filter(d => d > 1).length, frames_over_5mm: depth.filter(d => d > 5).length, drop_end: per.at(-1).drop };
    const h256 = createHash('sha256').update(readFileSync(sceneFile)).update(readFileSync('engine/three.js')).update(JSON.stringify(params)).update(`${w}x${h}@${fps}:${frames}`);
    const lock = readLock(pdir);
    lock.assets[opt.as] = { source: 'three', id: sceneFile, url: null, page: sceneFile, license: 'own (rendered from code) over the locked assets', author: 'c2v',
      sha256: h256.digest('hex'), opts: { params, frames, w, h }, meta: { kind: 'video', frames, fps, w, h, dur: frames / fps, params, measure, per_frame_depth_mm: depth },
      render: { s_per_frame: +((Date.now() - t0) / 1000 / frames).toFixed(2) }, fetched: new Date().toISOString() };
    writeLockPublic(pdir, lock);
    return { frames, w, h, ...measure, s_per_frame: lock.assets[opt.as].render.s_per_frame };
  } finally { await browser.close().catch(() => {}); srv.close(); }
}
