// splat.mjs: render captured scenes (3D Gaussian Splatting .ply) from code, in headless Chrome (engine/splat.js).
//
//   c2v splat <p> <scene.mjs> --as=<layer> [--frames=240] [--scale=.6667] [--params=json]   a camera move → frame layer
//   c2v splat --eval --ply=<f.ply> --colmap=<sparse/0> --images=<dir> --out=<dir> [--split=8]   held-out real views
//
// A scene module is code: PARAMS, ply(ctx) → path, camera(t, ctx) → { R, t, fx, fy, cx, cy } (COLMAP world→camera),
// optional edits(ctx) → static box edits (delete / tint) and extra(t, ctx) → procedural splats added to the frame.
// The capture supplies appearance; geometry edits, camera, timing and inserted objects stay parameters. The layer is
// recorded in assets.lock.json like a Blender layer (source "splat", sha256 over scene + renderer + params + ply size).
import { createServer } from 'node:http';
import { createReadStream, readFileSync, writeFileSync, mkdirSync, statSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { findChrome, baseFlags, gpuFlags } from './chrome.mjs';
import { readLock, writeLockPublic } from './assets.mjs';

// ---------- COLMAP sparse model (binary) ----------
const MODEL_PARAMS = { 0: 3, 1: 4, 2: 4, 3: 5, 4: 8, 5: 8, 6: 12, 7: 5, 8: 4, 9: 5, 10: 12 };
export function readColmap(dir) {
  const cb = readFileSync(join(dir, 'cameras.bin')), ib = readFileSync(join(dir, 'images.bin'));
  const cams = {}; let o = 8;
  for (let k = 0, n = Number(cb.readBigUInt64LE(0)); k < n; k++) {
    const id = cb.readInt32LE(o), model = cb.readInt32LE(o + 4), w = Number(cb.readBigUInt64LE(o + 8)), h = Number(cb.readBigUInt64LE(o + 16)); o += 24;
    const np = MODEL_PARAMS[model], params = Array.from({ length: np }, (_, i) => cb.readDoubleLE(o + i * 8)); o += np * 8;
    const [fx, fy, cx, cy] = [0, 2, 3, 8, 9].includes(model) ? [params[0], params[0], params[1], params[2]] : params.slice(0, 4);   // f, cx, cy (…) vs fx, fy, cx, cy
    cams[id] = { model, w, h, fx, fy, cx, cy };
  }
  const images = []; o = 8;
  for (let k = 0, n = Number(ib.readBigUInt64LE(0)); k < n; k++) {
    const [qw, qx, qy, qz, tx, ty, tz] = Array.from({ length: 7 }, (_, i) => ib.readDoubleLE(o + 4 + i * 8));
    const camId = ib.readInt32LE(o + 60); o += 64;
    let e = o; while (ib[e] !== 0) e++;
    const name = ib.toString('utf8', o, e); o = e + 1;
    o += 8 + Number(ib.readBigUInt64LE(o)) * 24;
    images.push({ name, R: quatToR(qw, qx, qy, qz), t: [tx, ty, tz], cam: cams[camId] });
  }
  return images.sort((a, b) => (a.name < b.name ? -1 : 1));
}
export function quatToR(w, x, y, z) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
/** Camera for an image of size (w, h): COLMAP intrinsics rescaled per axis. */
export const viewOf = (img, w, h) => ({ R: img.R, t: img.t, fx: img.cam.fx * w / img.cam.w, fy: img.cam.fy * h / img.cam.h, cx: img.cam.cx * w / img.cam.w, cy: img.cam.cy * h / img.cam.h });
/** Camera centre C = −Rᵀt. */
export const centerOf = v => [0, 1, 2].map(j => -(v.R[j] * v.t[0] + v.R[3 + j] * v.t[1] + v.R[6 + j] * v.t[2]));
/** World→camera from an eye, a target and an up vector (OpenCV axes: x right, y down, z forward). */
export function lookAt(eye, target, up) {
  const sub = (a, b) => a.map((v, i) => v - b[i]), nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const z = nrm(sub(target, eye)), x = nrm(cross(z, up)), y = cross(z, x);
  const R = [...x, ...y, ...z];
  return { R, t: [0, 1, 2].map(r => -(R[r * 3] * eye[0] + R[r * 3 + 1] * eye[1] + R[r * 3 + 2] * eye[2])) };
}

// ---------- page ----------
function serve(files) {
  const table = new Map(Object.entries(files));                   // a fixed whitelist; nothing else is served
  const srv = createServer((req, res) => {
    let f;
    try { f = table.get(decodeURIComponent(req.url.split('?')[0])); } catch { f = undefined; }
    if (!f || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html' }[extname(f)] || 'application/octet-stream', 'Content-Length': statSync(f).size });
    createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, port: srv.address().port })));
}
async function openPage(ply, w, h, init) {
  const { srv, port } = await serve({ '/splat.html': resolve('engine/splat.html'), '/splat.js': resolve('engine/splat.js'), '/scene.ply': resolve(ply) });
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, protocolTimeout: 600000, args: [...baseFlags(), ...gpuFlags({}), '--js-flags=--max-old-space-size=16384'] });
  const close = async () => { await browser.close().catch(() => {}); srv.close(); };
  try {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/splat.html`);
    const info = await page.evaluate((o) => window.SPLAT.init('/scene.ply', o), { ...init, w, h }).catch(e => { throw new Error(e.message + ' ' + errs.join(' | ')); });
    return { page, info, errs, close };
  } catch (e) { await close(); throw e; }
}
const dataUrlBytes = u => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
const fileSha256 = f => new Promise((ok, fail) => { const h = createHash('sha256'); createReadStream(f).on('data', b => h.update(b)).on('end', () => ok(h.digest('hex'))).on('error', fail); });

/** Render the held-out views of a COLMAP capture (every split-th image by name, as in Mip-NeRF 360) at the photo size. */
export async function evalViews({ ply, colmap, images, out, split = 8, which = 'test', ablate = [] }) {
  const imgs = readColmap(colmap), files = new Set(readdirSync(images));
  if (imgs.some(im => im.cam.model !== 1)) console.warn('splat eval: non-PINHOLE COLMAP cameras; distortion is ignored');
  // test: the held-out views (i % split == 0, as Brush --eval-split-every and Mip-NeRF 360); train: seen views, offset
  const picked = imgs.filter((_, i) => i % split === (which === 'train' ? split >> 1 : 0));
  const test = picked.filter(im => files.has(im.name));
  if (test.length < picked.length) console.warn(`splat eval: ${picked.length - test.length} views have no photo in ${images}`);
  if (!test.length) throw new Error('splat eval: no views to evaluate');
  const probe = await import('node:child_process').then(m => m.spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', join(images, test[0].name)], { encoding: 'utf8' }).stdout.trim().split(','));
  const [w, h] = probe.map(Number);
  const { page, info, close } = await openPage(ply, w, h, { ablate });
  mkdirSync(out, { recursive: true }); const times = [];
  try {
    for (const im of test) {
      const tm = await page.evaluate(c => window.SPLAT.render(c), viewOf(im, w, h));
      writeFileSync(join(out, im.name.replace(/\.\w+$/, '.png')), dataUrlBytes(await page.evaluate(() => window.SPLAT.png())));
      times.push(tm);
    }
  } finally { await close(); }
  const avg = k => +(times.reduce((s, x) => s + x[k], 0) / times.length).toFixed(0);
  return { views: test.length, w, h, splats: info.n, sh_degree: info.deg, framebuffer: info.framebuffer, ablate, ms: { sh: avg('sh_ms'), sort: avg('sort_ms'), draw: avg('draw_ms') } };
}

/** Render a scene module's camera move into projects/<p>/assets/<as>/f%05d.jpg and record the layer. */
export async function renderLayer(pdir, sceneFile, opt) {
  const mod = await import(pathToFileURL(resolve(sceneFile)).href);
  const params = { ...(mod.PARAMS || {}), ...JSON.parse(opt.params || '{}') };
  const sc = +(opt.scale || 1), w = Math.round(1920 * sc), h = Math.round(1080 * sc), fps = +(opt.fps || 24), frames = +(opt.frames || 120);
  const ctx = { params, P: k => params[k], w, h, fps, frames, pdir, readColmap, viewOf, centerOf, lookAt };
  const ply = mod.ply(ctx), edits = mod.edits ? mod.edits(ctx) : [];
  const plySha = await fileSha256(ply);
  const t0 = Date.now(), { page, info, close } = await openPage(ply, w, h, { edits, extraCap: mod.extraCap ? mod.extraCap(ctx) : 0 });
  const dir = join(pdir, 'assets', opt.as); mkdirSync(dir, { recursive: true });
  try {
    for (let f = 0; f < frames; f++) {
      const t = f / fps, cam = mod.camera(t, ctx), extra = mod.extra ? mod.extra(t, ctx) : undefined;
      await page.evaluate((c, e) => window.SPLAT.render(c, e), cam, extra);
      writeFileSync(join(dir, `f${String(f + 1).padStart(5, '0')}.jpg`), dataUrlBytes(await page.evaluate(() => window.SPLAT.jpg(0.92))));
    }
  } finally { await close(); }
  const s_per_frame = +((Date.now() - t0) / 1000 / frames).toFixed(2);
  const h256 = createHash('sha256').update(readFileSync(sceneFile)).update(readFileSync('engine/splat.js')).update(readFileSync('lib/splat.mjs'))
    .update(JSON.stringify(params)).update(plySha).update(`${w}x${h}@${fps}:${frames}`);
  const lock = readLock(pdir);
  lock.assets[opt.as] = { source: 'splat', id: sceneFile, url: null, page: sceneFile, license: 'derived from the capture: inherits its licence (see the capture entry)', author: 'c2v over the capture authors',
    sha256: h256.digest('hex'), opts: { params, frames, w, h }, capture: { ply: basename(ply), ply_sha256: plySha, splats: info.n, sh_degree: info.deg, edit_hits: info.hits, framebuffer: info.framebuffer },
    meta: { kind: 'video', frames, fps, w, h, dur: frames / fps, params }, render: { s_per_frame }, fetched: new Date().toISOString() };
  writeLockPublic(pdir, lock);
  return { frames, w, h, s_per_frame, splats: info.n, hits: info.hits };
}
