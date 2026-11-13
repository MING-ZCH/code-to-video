// splat-garden: a camera move through a captured real scene (Mip-NeRF 360 "garden", 3DGS trained with Brush), with the
// edits as code. The capture gives every pixel's appearance; the program decides the camera path, which splats are
// recoloured or removed, and which procedural objects are added (a ball bouncing on the table, physically timed).
//
// Scene frame (from the training cameras, scripts/dev/splat_scene_probe.py): the optical axes meet at FOCUS on the table
// top; UP is the mean camera up; the cameras orbit at radius ≈ 3.7 and ≈ 1.8 above the table. Table top ≈ height 0,
// pot and plant within r < 0.35 up to height ≈ 1.05, ground ≈ −1.2 (units: COLMAP, ≈ 0.6 m).
import { join } from 'node:path';
import { homedir } from 'node:os';

const DATA = process.env.C2V_SPLAT_DATA || join(homedir(), 'data', 'm360');
export const PARAMS = {
  ply: 'runs/garden30k/export_30000.ply', sparse: 'garden/sparse/0',
  orbit_start: -20, orbit_deg: 70, radius: 3.4, height: 1.5, dolly: 0.12, lens: 1.0,
  table_tint: null, remove_pot: false, ball: false, ball_color: [0.85, 0.12, 0.08], ball_r: 0.11, restitution: 0.72,
};
const FOCUS = [0.415, 1.509, 1.097], UP = [-0.002, -0.882, -0.471];
const E1 = [0.0, -0.471, 0.882], E2 = [-1.0, 0.001, 0.001];
const add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s);
// table surface height at the ball's spot, measured from the capture (splat_scene_probe.py … 0.55 -0.25): +0.0357.
// Resting the ball on height 0 (the axes' meeting point) sank it 0.036 (≈ 21 mm, a third of its radius) into the table.
const TABLE_TOP = 0.0357;

export const ply = ctx => join(DATA, ctx.P('ply'));

let K, Kkey;
function intrinsics(ctx) {
  if (Kkey !== `${ctx.w}x${ctx.h}`) {
    Kkey = `${ctx.w}x${ctx.h}`;
    const im = ctx.readColmap(join(DATA, ctx.P('sparse')))[0];
    const s = ctx.w / im.cam.w;                                    // keep the horizontal field of view; 16:9 crops height
    K = { fx: im.cam.fx * s, fy: im.cam.fy * s, cx: ctx.w / 2, cy: ctx.h / 2 };
  }
  return K;
}

/** Orbit around the table at the training cameras' radius and height, easing in, with a slow push-in (dolly). */
export function camera(t, ctx) {
  const dur = ctx.frames / ctx.fps, u = t / dur, e = u * u * (3 - 2 * u);
  const a = (ctx.P('orbit_start') + ctx.P('orbit_deg') * e) * Math.PI / 180;
  const r = ctx.P('radius') * (1 - ctx.P('dolly') * e);
  const eye = add(add(FOCUS, UP, ctx.P('height')), add(E1.map(v => v * Math.cos(a)), E2.map(v => v * Math.sin(a))), r);
  const k = intrinsics(ctx), lens = ctx.P('lens');
  return { ...ctx.lookAt(eye, add(FOCUS, UP, 0.35), UP), fx: k.fx * lens, fy: k.fy * lens, cx: k.cx, cy: k.cy };
}

export function edits(ctx) {
  const out = [];
  if (ctx.P('table_tint')) out.push({ op: 'tint', rgb: ctx.P('table_tint'), amount: 0.85, cyl: { c: FOCUS, up: UP, r: 1.62, h0: -0.12, h1: 0.03 } });
  if (ctx.P('remove_pot')) out.push({ op: 'delete', cyl: { c: FOCUS, up: UP, r: 0.5, h0: 0.035, h1: 1.4 } });
  return out;
}

export const extraCap = ctx => (ctx.P('ball') ? 2600 : 0);

/** A ball of small Gaussians bouncing on the table: height from free fall with restitution, Lambert shading from above. */
export function extra(t, ctx) {
  if (!ctx.P('ball')) return undefined;
  const g = 9.81 / 0.6, R = ctx.P('ball_r'), e = ctx.P('restitution');
  let h = 0, tt = t, v0 = Math.sqrt(2 * g * 0.9);                  // dropped from 0.9 above the table top
  let tb = v0 / g;                                                   // first fall
  if (tt < tb) h = 0.9 - 0.5 * g * tt * tt;
  else { tt -= tb; let v = v0 * e; while (tt > 2 * v / g && v > 0.05) { tt -= 2 * v / g; v *= e; } h = v > 0.05 ? v * tt - 0.5 * g * tt * tt : 0; }
  const c = add(add(add(FOCUS, E1, 0.55), E2, -0.25), UP, TABLE_TOP + R + Math.max(0, h));
  const out = [], n = 2400, s2 = (R * 0.09) ** 2, L = [0.3, 0.85, 0.42], col = ctx.P('ball_color');
  const Ln = Math.hypot(...L), sun = [L[0] / Ln, L[1] / Ln, L[2] / Ln];
  for (let i = 0; i < n; i++) {                                      // Fibonacci sphere
    const y = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(1 - y * y), ph = i * 2.399963229728653;
    const nl = [Math.cos(ph) * rr, y, Math.sin(ph) * rr];             // (E1, UP, E2) frame
    const nw = add(add(E1.map(v => v * nl[0]), UP.map(v => v * nl[1])), E2.map(v => v * nl[2]));
    const lam = Math.max(0, nl[0] * sun[0] + nl[1] * sun[1] + nl[2] * sun[2]), shade = 0.35 + 0.75 * lam;
    out.push({ p: add(c, nw, R), cov: [s2, 0, 0, s2, 0, s2], rgb: col.map(v => Math.min(1, v * shade)), a: 0.95 });
  }
  const sh = 0.75 * Math.max(0.15, 1 - h / 0.9);                    // contact shadow: flat dark Gaussians on the table
  const s = 0.03 ** 2, u = UP, flat = [s - (s - 1e-6) * u[0] * u[0], -(s - 1e-6) * u[0] * u[1], -(s - 1e-6) * u[0] * u[2],
    s - (s - 1e-6) * u[1] * u[1], -(s - 1e-6) * u[1] * u[2], s - (s - 1e-6) * u[2] * u[2]];
  for (let k = 0; k < 160; k++) {
    const a = k * 2.399963229728653, rr = R * 1.3 * Math.sqrt((k + 0.5) / 160);
    const p = add(add(add(FOCUS, E1, 0.55 + Math.cos(a) * rr), E2, -0.25 + Math.sin(a) * rr), UP, TABLE_TOP + 0.004);
    out.push({ p, cov: flat, rgb: [0.02, 0.02, 0.015], a: sh * 0.35 });
  }
  return out;
}
