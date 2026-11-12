// shaders.js: the "shader" medium. One fragment shader per style, applied as a full-frame pass with p5's filter().
//
//   stylize(name, u)  POST filters: restyle everything painted so far in this frame (tex0 = the canvas).
//                     oil (u.r = stroke radius) also applies to real footage and Blender layers
//                     cave, inkwash, blueprint, halftone, pixel (u.r = block size), crt, cel, thermal, stained (u.r = cell size)
//   shade(name, u)    GENERATORS: paint procedural imagery over what's there (explosion, shockwave, rays, fire).
//
// Both are pure functions of their uniforms: pass time-derived values (u.t, u.k …), never wall-clock time. Call them in
// screen space (after camEnd()), usually at the end of a shot. Uniforms (all optional):
//   t      seconds (drives drift/flicker; quantise it with onTwos() for a hand-made feel)
//   k      0..1 amount / progress (style strength, explosion growth …)
//   seed   any number (varies the noise)
//   at     [x, y] centre in frame pixels (generators)
//   r      radius / size in frame pixels (generators)
//   c1 c2 c3  colours as hex strings
// Cost: one pass per call, independent of scene complexity (≈ the cost of one fullscreen fill).

const GLSL_LIB = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec2 canvasSize;
uniform vec2 texelSize;
uniform float u_t, u_k, u_seed, u_r;
uniform vec2 u_at;
uniform vec3 u_c1, u_c2, u_c3;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21) + u_seed * .013); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
vec3 tex(vec2 uv) { return texture2D(tex0, clamp(uv, 0., 1.)).rgb; }
float sobel(vec2 uv, float px) {
  vec2 d = texelSize * px;
  float tl = luma(tex(uv + d * vec2(-1, -1))), t = luma(tex(uv + d * vec2(0, -1))), tr = luma(tex(uv + d * vec2(1, -1)));
  float l = luma(tex(uv + d * vec2(-1, 0))), r = luma(tex(uv + d * vec2(1, 0)));
  float bl = luma(tex(uv + d * vec2(-1, 1))), b = luma(tex(uv + d * vec2(0, 1))), br = luma(tex(uv + d * vec2(1, 1)));
  float gx = -tl - 2. * l - bl + tr + 2. * r + br, gy = -tl - 2. * t - tr + bl + 2. * b + br;
  return sqrt(gx * gx + gy * gy);
}
vec2 px() { return vTexCoord * canvasSize; }            // frame pixels, origin top-left (vTexCoord.y runs down in p5 filters)
`;

const STYLES = {
  // Cave painting: earth pigments on rock. Luminance → 4 ochre/rust/charcoal bands, charcoal contours, rock grain.
  cave: `void main() {
    vec2 uv = vTexCoord; float n = fbm(px() / 90.), g = fbm(px() / 9. + 3.);
    float L = luma(tex(uv)) + (n - .5) * .25;
    vec3 rock = mix(vec3(.55, .42, .30), vec3(.72, .58, .42), n);
    vec3 pig = L < .3 ? vec3(.16, .11, .09) : L < .5 ? vec3(.55, .2, .12) : L < .7 ? vec3(.78, .48, .2) : rock;
    float e = smoothstep(.35, .8, sobel(uv, 2.5));
    vec3 c = mix(rock, pig, .85 * mix(1., g, .35));
    c = mix(c, vec3(.12, .09, .08), e * (.6 + .4 * g));
    gl_FragColor = vec4(mix(tex(uv), c, u_k), 1.);
  }`,
  // Sumi-e ink wash: grey ink in a few dilutions on warm paper, soft bleed, dark brush edges.
  inkwash: `void main() {
    vec2 uv = vTexCoord; vec3 acc = vec3(0.);
    for (int i = 0; i < 8; i++) { float a = float(i) * .785; acc += tex(uv + texelSize * 3.5 * vec2(cos(a), sin(a)) * (1. + vnoise(px() / 30.))); }
    float L = luma(acc / 8.), n = fbm(px() / 40.);
    float ink = 1. - smoothstep(.08, .95, L + (n - .5) * .2);
    ink = floor(ink * 4. + .5) / 4.;
    float e = smoothstep(.3, .9, sobel(uv, 2.));
    vec3 paper = vec3(.95, .92, .85) - .05 * fbm(px() / 6.);
    vec3 c = mix(paper, vec3(.12, .12, .14), clamp(ink * .85 + e * .8, 0., 1.));
    gl_FragColor = vec4(mix(tex(uv), c, u_k), 1.);
  }`,
  // Blueprint: edges as pale cyan lines on Prussian blue, with a drafting grid.
  blueprint: `void main() {
    vec2 uv = vTexCoord, p = px();
    float e = smoothstep(.2, .6, sobel(uv, 1.5));
    vec2 gq = abs(fract(p / 48.) - .5); float grid = smoothstep(.485, .5, max(gq.x, gq.y)) * .18;
    vec2 gq2 = abs(fract(p / 240.) - .5); grid += smoothstep(.494, .5, max(gq2.x, gq2.y)) * .25;
    vec3 c = vec3(.07, .22, .45) + .05 * vnoise(p / 200.);
    c = mix(c, vec3(.85, .95, 1.), clamp(e + grid, 0., 1.));
    gl_FragColor = vec4(mix(tex(uv), c, u_k), 1.);
  }`,
  // Newsprint halftone: rotated dot screen sized by darkness, two inks.
  halftone: `void main() {
    vec2 uv = vTexCoord, p = px(); float s = 9.;
    mat2 R = mat2(.966, -.259, .259, .966); vec2 q = R * p, cell = (floor(q / s) + .5) * s;
    vec2 cp = (mat2(.966, .259, -.259, .966) * cell) / canvasSize;
    vec3 src = tex(cp); float d = 1. - luma(src);
    float dd = 1. - smoothstep(-.8, .8, length(q - cell) - s * .62 * sqrt(d));
    vec3 inkc = mix(vec3(.12, .1, .14), src * .8, .55);
    vec3 c = mix(vec3(.96, .93, .86), inkc, dd);
    gl_FragColor = vec4(mix(tex(uv), c, u_k), 1.);
  }`,
  // 8-bit: big pixels, 3-3-2 bit colour, ordered dither.
  pixel: `void main() {
    float b = mix(6., 18., clamp(u_r / 20., 0., 1.)); if (u_r <= 0.) b = 10.;
    vec2 cell = floor(px() / b), uv = (cell + .5) * b / canvasSize;
    vec3 c = tex(uv);
    float bay = mod(cell.x + cell.y * 2., 4.) / 4. - .375;
    c = floor(c * vec3(7., 7., 3.) + bay + .5) / vec3(7., 7., 3.);
    gl_FragColor = vec4(mix(tex(vTexCoord), c, u_k), 1.);
  }`,
  // CRT monitor: barrel warp, RGB split, scanlines, vignette, deterministic flicker from u_t.
  crt: `void main() {
    vec2 uv = vTexCoord - .5; uv *= 1. + .12 * dot(uv, uv); uv += .5;
    float sh = 1.5 * texelSize.x * (1. + 2. * u_k);
    vec3 c = vec3(tex(uv + vec2(sh, 0)).r, tex(uv).g, tex(uv - vec2(sh, 0)).b);
    float scan = .82 + .18 * sin(uv.y * canvasSize.y * 3.14159 / 2.);
    float fl = .96 + .04 * h21(vec2(floor(u_t * 24.), 1.));
    vec2 v = uv * (1. - uv); float vig = pow(v.x * v.y * 16., .25);
    c *= scan * fl * vig; c = mix(c, c * vec3(.85, 1.08, .9), .5);
    if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) c = vec3(.02);
    gl_FragColor = vec4(mix(tex(vTexCoord), c, u_k), 1.);
  }`,
  // Cel / comic: posterised colour with heavy ink contours.
  cel: `void main() {
    vec2 uv = vTexCoord; vec3 c = tex(uv);
    c = floor(c * 4. + .5) / 4.;
    float e = smoothstep(.25, .55, sobel(uv, 1.8));
    c = mix(c, vec3(.08, .06, .1), e);
    gl_FragColor = vec4(mix(tex(uv), c, u_k), 1.);
  }`,
  // Thermal camera: luminance → heat ramp, low-res sensor noise.
  thermal: `void main() {
    vec2 uv = vTexCoord; float L = luma(tex(uv)) + .04 * (h21(floor(px() / 3.) + floor(u_t * 12.)) - .5);
    vec3 c = L < .25 ? mix(vec3(.02, .0, .15), vec3(.4, .0, .55), L / .25)
           : L < .5 ? mix(vec3(.4, .0, .55), vec3(.95, .2, .1), (L - .25) / .25)
           : L < .75 ? mix(vec3(.95, .2, .1), vec3(1., .8, .1), (L - .5) / .25) : mix(vec3(1., .8, .1), vec3(1.), (L - .75) / .25);
    gl_FragColor = vec4(mix(tex(uv), c, u_k), 1.);
  }`,
  // Oil paint: a 4-sector Kuwahara filter (u.r = radius px, default 7) flattens regions into strokes while keeping edges,
  // then a canvas weave and a light impasto relief (luminance gradient as a bump) sit on top.
  oil: `void main() {
    vec2 uv = vTexCoord; float r = u_r > 0. ? min(u_r, 10.) : 7.;
    vec3 m0 = vec3(0.), m1 = vec3(0.), m2 = vec3(0.), m3 = vec3(0.), s0 = vec3(0.), s1 = vec3(0.), s2 = vec3(0.), s3 = vec3(0.); float n = 0.;
    for (int j = 0; j <= 10; j++) { if (float(j) > r) break;
      for (int i = 0; i <= 10; i++) { if (float(i) > r) break;
        vec2 o = vec2(float(i), float(j)) * texelSize;
        vec3 a = tex(uv + vec2(-o.x, -o.y)), b = tex(uv + vec2(o.x, -o.y)), c = tex(uv + vec2(-o.x, o.y)), d = tex(uv + o);
        m0 += a; s0 += a * a; m1 += b; s1 += b * b; m2 += c; s2 += c * c; m3 += d; s3 += d * d; n += 1.;
      } }
    m0 /= n; m1 /= n; m2 /= n; m3 /= n;
    float v0 = dot(s0 / n - m0 * m0, vec3(1.)), v1 = dot(s1 / n - m1 * m1, vec3(1.)), v2 = dot(s2 / n - m2 * m2, vec3(1.)), v3 = dot(s3 / n - m3 * m3, vec3(1.));
    vec3 c = m0; float v = v0; if (v1 < v) { v = v1; c = m1; } if (v2 < v) { v = v2; c = m2; } if (v3 < v) { c = m3; }
    vec2 p = px(); float weave = .5 + .25 * (sin(p.x * 1.9) * sin(p.y * 1.9)) + .25 * fbm(p / 3.);
    float bx = luma(tex(uv + vec2(texelSize.x * 2., 0.))) - luma(tex(uv - vec2(texelSize.x * 2., 0.)));
    float by = luma(tex(uv + vec2(0., texelSize.y * 2.))) - luma(tex(uv - vec2(0., texelSize.y * 2.)));
    float relief = clamp(.5 + 2.2 * (bx - by), 0., 1.);
    c = c * (.9 + .2 * weave) * (.85 + .3 * relief);
    c = mix(vec3(luma(c)), c, 1.15);
    gl_FragColor = vec4(mix(tex(uv), clamp(c, 0., 1.), u_k), 1.);
  }`,
  // Stained glass: Voronoi cells take the colour at their centre, dark lead between them.
  stained: `void main() {
    float cs = u_r > 0. ? u_r : 46.;                                  // cell size in px (u.r)
    vec2 p = px() / cs; vec2 ip = floor(p); float d1 = 9., d2 = 9.; vec2 best = vec2(0.);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = ip + vec2(i, j), o = g + .15 + .7 * vec2(h21(g), h21(g + 7.)); float d = length(p - o);
      if (d < d1) { d2 = d1; d1 = d; best = o; } else if (d < d2) d2 = d; }
    vec3 c = tex(best * cs / canvasSize) * 1.15;
    c = mix(c, vec3(.08, .07, .07), 1. - smoothstep(.04, .1, d2 - d1));
    gl_FragColor = vec4(mix(tex(vTexCoord), c, u_k), 1.);
  }`,
};

const GENS = {
  // Nuclear-style explosion (cartoon, not physical): flash core → fireball → stem + mushroom cap, rolling smoke.
  // k 0..1 = life of the blast; at = ground zero (frame px); r = cap radius at full size.
  explosion: `void main() {
    vec2 p = px(), g = u_at; float k = u_k, R = max(u_r, 40.);
    vec3 base = tex(vTexCoord);
    float grow = 1. - pow(1. - clamp(k * 1.6, 0., 1.), 3.);                  // fast rise, then holds
    float rise = clamp((k - .08) / .7, 0., 1.);
    vec2 capC = g - vec2(0., R * (.2 + 1.6 * rise));
    float roll = u_t * .35;
    vec2 q = (p - capC) / (R * (.35 + .65 * grow));
    float cap = length(q * vec2(1., 1.55)) - 1. + .35 * (fbm(q * 2.2 + vec2(roll, -roll)) - .5);
    float stemW = R * (.12 + .1 * grow) * (1. + .25 * fbm(vec2(p.y / 60., roll)));
    float stem = (abs(p.x - g.x) - stemW) / R; stem = max(stem, (capC.y - p.y) / R); stem = max(stem, (p.y - g.y) / R);
    float skirt = length((p - g) / (R * vec2(1.3, .35) * (.3 + grow))) - 1. + .3 * fbm((p - g) / 70. + roll);
    float d = min(min(cap, stem), skirt);
    float body = 1. - smoothstep(-.02, .06, d);
    float n = fbm((p - capC) / (R * .25) + vec2(0., -roll * 2.)), n2 = fbm((p - capC) / (R * .09) - roll);
    // heat: hot everywhere at first, then it retreats into the cap's underside and the stem core (fire inside smoke)
    float core = 1. - smoothstep(-.9, -.15, d);
    float under = (1. - smoothstep(-.6, .2, q.y)) * core;
    float heat = clamp((1. - rise * 1.1) * (1. - smoothstep(-.7, .1, d)) + .75 * under * (1. - rise * .55), 0., 1.);
    vec3 smoke = mix(u_c3 * .7, u_c3 * 1.45, smoothstep(.3, .75, n) * .7 + .3 * n2);
    vec3 fire = mix(u_c2, u_c1, smoothstep(.15, .85, heat + .35 * n));
    vec3 c = mix(smoke, fire, clamp(heat * 1.5, 0., 1.));
    c *= .78 + .32 * smoothstep(-1., 1., -q.y);                                 // lit from below by the fire
    float rim = (1. - smoothstep(0., .07, abs(d + .01))) * smoothstep(0., .15, k);     // ink edge: sits in the painted world
    c = mix(c, vec3(.17, .13, .2), rim * .8);
    float flash = exp(-k * 18.) * (1. - smoothstep(0., R * 3.5, length(p - g)));
    vec3 outc = mix(base, c, body * clamp(k * 12., 0., 1.));
    outc += flash * vec3(1., .95, .8);
    float halo = (1. - smoothstep(0., R * 2.4, length(p - capC))) * heat * .5;
    outc += halo * u_c1 * .6;
    gl_FragColor = vec4(min(outc, 1.), 1.);
  }`,
  // Shockwave ring: refracts what's under it and brightens the front. k 0..1 = ring travel; r = max radius.
  shockwave: `void main() {
    vec2 p = px(); float rad = u_k * u_r, w = 40. + 60. * u_k;
    float d = length(p - u_at) - rad, ring = exp(-d * d / (w * w));
    vec2 dir = normalize(p - u_at + 1e-4);
    vec3 c = tex((p - dir * ring * 28. * (1. - u_k)) / canvasSize);
    c += ring * (1. - u_k) * .35 * u_c1;
    gl_FragColor = vec4(c, 1.);
  }`,
  // God rays from a point (sun, lamp, portal): additive, beat-friendly via k.
  rays: `void main() {
    vec2 p = px() - u_at; float a = atan(p.y, p.x), l = length(p);
    float beams = pow(.5 + .5 * sin(a * 14. + u_seed + u_t * .4), 6.) * (.6 + .4 * vnoise(vec2(a * 6., u_t)));
    float fall = exp(-l / max(u_r, 50.));
    gl_FragColor = vec4(tex(vTexCoord) + u_c1 * beams * fall * u_k, 1.);
  }`,
  // Fire sheet rising from the bottom edge (or from y = at.y): k = height 0..1.
  fire: `void main() {
    vec2 p = px(); float base = u_at.y > 0. ? u_at.y : canvasSize.y;
    float y = (base - p.y) / (canvasSize.y * max(u_k, .001));
    float n = fbm(vec2(p.x / 90., p.y / 70. + u_t * 1.6));
    float f = clamp(1. - y + (n - .5) * .9, 0., 1.);
    vec3 c = mix(u_c2, u_c1, f * f);
    float a = smoothstep(.05, .35, f) * step(0., y);
    gl_FragColor = vec4(mix(tex(vTexCoord), c, a), 1.);
  }`,
};

const _SH = {};
const _hex3 = h => { const c = color(h); return [red(c) / 255, green(c) / 255, blue(c) / 255]; };
function _shader(kind, name) {
  const src = (kind === 'S' ? STYLES : GENS)[name];
  if (!src) throw new Error(`unknown ${kind === 'S' ? 'style' : 'generator'} "${name}"`);
  return _SH[kind + name] || (_SH[kind + name] = createFilterShader(GLSL_LIB + src));
}
function _pass(s, u) {
  flushBrush();                                    // land every pending brush stroke before the pass reads the canvas
  s.setUniform('u_t', u.t ?? 0); s.setUniform('u_k', u.k ?? 1); s.setUniform('u_seed', u.seed ?? 0); s.setUniform('u_r', u.r ?? 0);
  s.setUniform('u_at', u.at || [W / 2, H / 2]);
  s.setUniform('u_c1', _hex3(u.c1 || '#FFF3C4')); s.setUniform('u_c2', _hex3(u.c2 || '#F07A2C')); s.setUniform('u_c3', _hex3(u.c3 || '#6B5A5A'));
  push(); resetMatrix(); filter(s); pop();
}
function stylize(name, u = {}) { _pass(_shader('S', name), u); }
function shade(name, u = {}) { _pass(_shader('G', name), u); }
