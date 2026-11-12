// real.js: the realism layer. Real footage and photos as the picture, a film-camera finish on top, still f(t).
//
//   PROJECT.look = 'real'       no paper under the frame and no paper grain over it (grade() supplies film grain instead)
//   PROJECT.footage = true      studio.html loads projects/<name>/assets/assets.js (window.ASSET_META, from `c2v assets`)
//   PROJECT.shutter = { samples: 6, angle: .5 }   motion blur: each frame averages `samples` sub-frames spread over
//                               angle/fps seconds around t (angle .5 = a 180° shutter). Costs `samples` × a frame.
//
// footage(name, st, x, y, w, h, o)   draws source time `st` (seconds into the clip) of a fetched video, or the image of an
//                                    image asset, in world space (follows the camera). Frames are files, loaded on demand.
//     o.src [sx, sy, sw, sh]   crop in source pixels       o.alpha 0..1      o.loop   wrap st instead of holding the ends
//     o.blend 'screen' | 'add' | 'multiply' | 'lightest' | 'darkest'   for elements shot on black (fire, sparks, smoke)
//     o.key { col: '#00FF00', sim: .12, smooth: .08, spill: .8 }       chroma key for green-screen elements
//     o.slot                  a name for the upload canvas when one clip is drawn twice at different times in a frame
// strobe(name, times, x, y, w, h, o) chronophotography: several source times composited with lightest/darkest
//                                    (o.mode, default 'darkest' for a dark subject on a light ground), then the live frame
// grade(u)                           film finish over everything so far (screen space, after camEnd()). Uniforms:
//     exposure (stops), contrast, sat, temp (-1 cool .. 1 warm), tint, lift, gamma, gain, filmic (0..1 tone curve),
//     bloom, bloomThr, halation, ca (chromatic aberration px), vignette, grain, letterbox (bar height, frame fraction),
//     t (grain frame; pass the video time), fade (0..1 to black)
// handheld(t, amp, seed)             { x, y, r }: a smooth, deterministic hand-held camera drift (px, px, rad) to add to camBegin
// speedRamp(lt, keys)                source time for shot time lt under a speed curve: keys [[lt0, speed0], [lt1, speed1], …],
//                                    speed is linear between keys and integrated exactly, so ramps stay f(t)

const REAL = typeof PROJECT !== 'undefined' && PROJECT.look === 'real';
const FOOT = { cache: new Map(), miss: new Map(), slots: {}, cap: 160 };

function assetMeta(name) {
  const m = window.ASSET_META && window.ASSET_META[name];
  if (!m) throw new Error(`no asset "${name}": run c2v assets ${window.PROJECT_NAME} fetch <source>:<id> --as=${name} (and set PROJECT.footage)`);
  return m;
}
function footURL(name, i) {
  const m = assetMeta(name), base = `projects/${window.PROJECT_NAME}/${m.dir}/`;
  return m.kind === 'video' ? base + `f${String(i + 1).padStart(5, '0')}.jpg` : base + m.file;
}
function footIndex(m, st, loop) {
  if (m.kind !== 'video') return 0;
  const i = Math.floor(st * m.fps + 1e-6);
  return loop ? ((i % m.frames) + m.frames) % m.frames : Math.max(0, Math.min(m.frames - 1, i));
}
function footImage(name, i) {
  const key = name + ':' + i, img = FOOT.cache.get(key);
  if (img) { FOOT.cache.delete(key); FOOT.cache.set(key, img); return img; }        // LRU refresh
  FOOT.miss.set(key, footURL(name, i)); return null;
}
const footPending = () => FOOT.miss.size > 0;
async function footLoad() {
  const jobs = [...FOOT.miss.entries()]; FOOT.miss.clear();
  // onload only: img.decode() never settles in a page that isn't producing frames (every render worker but the first one)
  await Promise.all(jobs.map(([key, url]) => new Promise((ok, bad) => {
    const img = new Image(); img.onload = () => { FOOT.cache.set(key, img); ok(); }; img.onerror = () => bad(new Error('footage frame missing: ' + url)); img.src = url;
  })));
  while (FOOT.cache.size > FOOT.cap) FOOT.cache.delete(FOOT.cache.keys().next().value);
}
function footSlot(slot, w, h) {
  let g = FOOT.slots[slot];
  if (!g || g.width !== w || g.height !== h) { g = FOOT.slots[slot] = createGraphics(w, h); g.pixelDensity(1); }
  return g;
}

const KEY_FRAG = `precision highp float; varying vec2 vUv; uniform sampler2D uTex; uniform vec4 uSrc; uniform vec3 uKey; uniform float uSim, uSmooth, uSpill, uAlpha;
vec2 cbcr(vec3 c) { return vec2(-.169 * c.r - .331 * c.g + .5 * c.b, .5 * c.r - .419 * c.g - .081 * c.b); }
void main() {
  vec3 c = texture2D(uTex, uSrc.xy + vUv * uSrc.zw).rgb;
  float a = smoothstep(uSim, uSim + uSmooth, distance(cbcr(c), cbcr(uKey)));
  float spill = max(0., c.g - max(c.r, c.b)); c.g -= spill * uSpill;
  gl_FragColor = vec4(c * a * uAlpha, a * uAlpha);
}`;
let KEY_SH = null;

function footage(name, st, x = 0, y = 0, w = W, h = H, o = {}) {
  const m = assetMeta(name);
  // o.smooth: between two source frames (slow motion), cross-fade frame i into i+1 by the fraction instead of holding i
  if (o.smooth && m.kind === 'video' && !o._next) {
    const f = st * m.fps + 1e-6 - Math.floor(st * m.fps + 1e-6), drawn = footage(name, st, x, y, w, h, { ...o, smooth: false });
    if (f > .02 && drawn) footage(name, st + 1 / m.fps, x, y, w, h, { ...o, smooth: false, _next: true, slot: (o.slot || name) + '#next', alpha: f * (o.alpha ?? 1) });
    return drawn;
  }
  const i = footIndex(m, st, o.loop), img = footImage(name, i);
  if (!img) return false;
  flushBrush();                                                    // what was painted so far lands under the footage
  const g = footSlot(o.slot || name, img.naturalWidth, img.naturalHeight);
  if (g._c2vKey !== name + ':' + i) { g.drawingContext.drawImage(img, 0, 0); g._c2vKey = name + ':' + i; }
  const [sx, sy, sw, sh] = o.src || [0, 0, g.width, g.height];
  push();
  if (o.key) {
    if (!KEY_SH) KEY_SH = createShader(GLOW_VERT, KEY_FRAG);
    const k = color(o.key.col || '#00FF00');
    noStroke(); shader(KEY_SH);
    KEY_SH.setUniform('uTex', g); KEY_SH.setUniform('uSrc', [sx / g.width, sy / g.height, sw / g.width, sh / g.height]);
    KEY_SH.setUniform('uKey', [red(k) / 255, green(k) / 255, blue(k) / 255]); KEY_SH.setUniform('uSim', o.key.sim ?? .12);
    KEY_SH.setUniform('uSmooth', o.key.smooth ?? .08); KEY_SH.setUniform('uSpill', o.key.spill ?? .8); KEY_SH.setUniform('uAlpha', clamp(o.alpha ?? 1));
    rect(x, y, w, h); resetShader();
  } else {
    const B = { screen: SCREEN, add: ADD, multiply: MULTIPLY, lightest: LIGHTEST, darkest: DARKEST }[o.blend];
    if (B) blendMode(B);
    if (o.alpha != null && o.alpha < 1) tint(255, 255 * clamp(o.alpha));
    image(g, x, y, w, h, sx, sy, sw, sh);
    noTint(); blendMode(BLEND);
  }
  pop();
  return true;
}

function strobe(name, times, x = 0, y = 0, w = W, h = H, o = {}) {
  times.forEach((st, k) => footage(name, st, x, y, w, h, { ...o, slot: name + '#strobe' + k, blend: k ? (o.mode || 'darkest') : undefined }));
}

// Integrates a piecewise-linear speed curve, so a ramp from 1× into .25× slow motion and back is exact at every lt.
function speedRamp(lt, keys) {
  let st = Math.min(lt, keys[0][0]) * keys[0][1];                  // constant speed before the first key
  for (let i = 0; i < keys.length; i++) {
    const [a, va] = keys[i], next = keys[i + 1];
    if (lt <= a) break;
    const b = next ? next[0] : Infinity, e = Math.min(lt, b), vE = next ? lerp(va, next[1], (e - a) / (b - a)) : va;
    st += (e - a) * (va + vE) / 2;
  }
  return st;
}

function handheld(t, amp = 1, seed = 0) {
  const s = (f, p) => Math.sin(t * f + p + seed * 1.618);
  return { x: amp * (9 * s(.71, 0) + 4 * s(1.93, 1.3) + 1.5 * s(4.7, 2.1)), y: amp * (6 * s(.53, .7) + 3 * s(2.31, 2.9) + 1.2 * s(5.3, .4)), r: amp * .0018 * (s(.37, 1.1) + .5 * s(1.7, .2)) };
}

const GRADE_FRAG = `
uniform float g_exposure, g_contrast, g_sat, g_temp, g_tint, g_lift, g_gamma, g_gain, g_filmic, g_bloom, g_bloomThr, g_halation, g_ca, g_vignette, g_grain, g_letterbox, g_fade, g_defocus;
vec3 filmic(vec3 x) { const float a = 2.51, b = .03, c = 2.43, d = .59, e = .14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0., 1.); }
vec3 bright(vec2 uv) { vec3 c = tex(uv); return max(c - g_bloomThr, 0.) / max(1. - g_bloomThr, .001); }
void main() {
  vec2 uv = vTexCoord, d = uv - .5;
  vec3 c = g_ca > 0. ? vec3(tex(uv + d * texelSize * g_ca * 2.).r, tex(uv).g, tex(uv - d * texelSize * g_ca * 2.).b) : tex(uv);
  if (g_defocus > .5) {                                              // lens defocus: a disc of 1 + 3 rings × 12 taps
    vec3 s = c; float n = 1.;
    for (int r = 1; r <= 3; r++) for (int k = 0; k < 12; k++) {
      float a = float(k) * .5236 + float(r) * .26; s += tex(uv + vec2(cos(a), sin(a)) * g_defocus * float(r) / 3. * texelSize); n += 1.;
    }
    c = s / n;
  }
  if (g_bloom > 0. || g_halation > 0.) {
    vec3 b = vec3(0.); float wsum = 0.;
    for (int r = 1; r <= 3; r++) for (int k = 0; k < 8; k++) {
      float a = float(k) * .785 + float(r) * .39, rad = float(r * r) * 9.; vec2 o = vec2(cos(a), sin(a)) * rad * texelSize;
      float w = 1. / float(r); b += bright(uv + o) * w; wsum += w;
    }
    b /= wsum;
    c += b * g_bloom;
    c += vec3(1., .35, .15) * dot(b, vec3(.33)) * g_halation;
  }
  c *= exp2(g_exposure);
  c *= vec3(1. + .12 * g_temp - .04 * g_tint, 1. + .06 * g_tint, 1. - .12 * g_temp - .04 * g_tint);
  c = mix(c, filmic(c * 1.15), g_filmic);
  float L = luma(c); c = mix(vec3(L), c, g_sat);
  c = (c - .5) * g_contrast + .5;
  c = pow(max(c * g_gain + g_lift * (1. - c), 0.), vec3(1. / g_gamma));
  c *= mix(1., smoothstep(1.15, .35, length(d * vec2(1.1, 1.))), g_vignette);
  float gr = h21(floor(px() / 1.5) + floor(u_t * 24.) * 17.13) - .5;
  c += gr * g_grain * (1.2 - L);
  c *= 1. - g_fade;
  if (abs(d.y) > .5 - g_letterbox) c = vec3(0.);
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`;
let GRADE_SH = null;
function grade(u = {}) {
  if (!GRADE_SH) GRADE_SH = createFilterShader(GLSL_LIB + GRADE_FRAG);
  flushBrush();
  const s = GRADE_SH, v = (k, d) => s.setUniform('g_' + k, u[k] ?? d);
  s.setUniform('u_t', u.t ?? 0); s.setUniform('u_seed', 0); s.setUniform('u_k', 1); s.setUniform('u_r', 0); s.setUniform('u_at', [W / 2, H / 2]);
  s.setUniform('u_c1', [1, 1, 1]); s.setUniform('u_c2', [1, 1, 1]); s.setUniform('u_c3', [1, 1, 1]);
  v('exposure', 0); v('contrast', 1); v('sat', 1); v('temp', 0); v('tint', 0); v('lift', 0); v('gamma', 1); v('gain', 1); v('filmic', 0);
  v('bloom', 0); v('bloomThr', .75); v('halation', 0); v('ca', 0); v('vignette', 0); v('grain', 0); v('letterbox', 0); v('fade', 0); v('defocus', 0);
  push(); resetMatrix(); filter(s); pop();
}
