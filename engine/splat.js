// splat.js: a deterministic 3D Gaussian Splatting renderer (WebGL2), driven page-side by lib/splat.mjs.
//
// A captured scene (3DGS .ply: position, scale, rotation, opacity, SH degree ≤ 3) is drawn through a pinhole camera
// given as COLMAP/OpenCV extrinsics (world→camera R, t) and intrinsics (fx, fy, cx, cy). Per frame, the CPU evaluates the
// view-dependent SH colour and sorts splats back to front (LSD radix sort on the float depth bits); the GPU projects each
// 3D covariance with the EWA Jacobian (Σ' = J W Σ Wᵀ Jᵀ + 0.3 I, as in 3DGS) and blends premultiplied colour in that
// order into a float framebuffer, resolved to 8 bits at the end. Colours are not clamped to [0, 1] per splat (only
// below 0, as in Brush): on Mip-NeRF 360 garden the clamp alone cost 0.81 dB, 8-bit blending 0.07 dB. Splat extent,
// frustum clamp, the 0.3 px² blur and the 0.999 opacity cap follow Brush's rasterizer.
// No asynchronous worker: a frame is a function of (scene, edits, camera, extra splats) only.
(() => {
  const SH_C0 = 0.28209479177387814, SH_C1 = 0.4886025119029199;
  const SH_C2 = [1.0925484305920792, -1.0925484305920792, 0.31539156525252005, -1.0925484305920792, 0.5462742152960396];
  const SH_C3 = [-0.5900435899266435, 2.890611442640554, -0.4570457994644658, 0.3731763325901154, -0.4570457994644658, 1.445305721320277, -0.5900435899266435];
  const TEXW = 4096;

  const VS = `#version 300 es
  precision highp float; precision highp int; precision highp sampler2D;
  uniform sampler2D uCenter, uCovA, uCovB, uColor;
  uniform mat3 uR; uniform vec3 uT; uniform vec4 uK; uniform vec2 uView;
  in vec2 aCorner; in uint aIndex;
  out vec4 vColor; out vec2 vD; out vec3 vConic;
  ivec2 tc(uint i) { return ivec2(int(i % ${TEXW}u), int(i / ${TEXW}u)); }
  void main() {
    ivec2 c = tc(aIndex);
    vec4 cen = texelFetch(uCenter, c, 0);
    vec3 p = uR * cen.xyz + uT;
    if (p.z < 0.01 || cen.w < 1.0 / 255.0) { gl_Position = vec4(0, 0, 2, 1); return; }   // Brush's near plane
    vec4 a = texelFetch(uCovA, c, 0), b = texelFetch(uCovB, c, 0);
    mat3 S = mat3(a.x, a.y, a.z, a.y, a.w, b.x, a.z, b.x, b.y);
    vec2 lp = (1.15 * uView - uK.zw) / uK.xy, ln = (-0.15 * uView - uK.zw) / uK.xy;
    float x = clamp(p.x / p.z, ln.x, lp.x) * p.z, y = clamp(p.y / p.z, ln.y, lp.y) * p.z;
    mat3 J = mat3(uK.x / p.z, 0.0, 0.0, 0.0, uK.y / p.z, 0.0, -uK.x * x / (p.z * p.z), -uK.y * y / (p.z * p.z), 0.0);
    mat3 T = J * uR;
    mat3 cov = T * S * transpose(T);
    float c00 = cov[0][0] + 0.3, c01 = cov[1][0], c11 = cov[1][1] + 0.3;
    float det = c00 * c11 - c01 * c01;
    if (det <= 0.0) { gl_Position = vec4(0, 0, 2, 1); return; }
    vConic = vec3(c11, -c01, c00) / det;
    float mid = 0.5 * (c00 + c11), lam = mid + sqrt(max(0.1, mid * mid - det));
    float r = ceil(sqrt(2.0 * max(0.0, log(255.0 * cen.w))) * sqrt(lam));
    if (r <= 0.0) { gl_Position = vec4(0, 0, 2, 1); return; }
    vec2 uv = vec2(uK.x * p.x / p.z + uK.z, uK.y * p.y / p.z + uK.w);
    vD = aCorner * r;
    vec2 px = uv + vD;
    gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
    vColor = vec4(max(texelFetch(uColor, c, 0).rgb, vec3(0.0)), cen.w);
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec4 vColor; in vec2 vD; in vec3 vConic; out vec4 o;
  void main() {
    float power = -0.5 * (vConic.x * vD.x * vD.x + vConic.z * vD.y * vD.y) - vConic.y * vD.x * vD.y;
    if (power > 0.0) discard;
    float alpha = min(0.999, vColor.a * exp(power));
    if (alpha < 1.0 / 255.0) discard;
    o = vec4(vColor.rgb * alpha, alpha);
  }`;

  const RVS = `#version 300 es
  void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0, 1); }`;
  const RFS = `#version 300 es
  precision highp float; uniform sampler2D uImg; out vec4 o;
  void main() { o = vec4(clamp(texelFetch(uImg, ivec2(gl_FragCoord.xy), 0).rgb, 0.0, 1.0), 1.0); }`;

  const S = { gl: null, n: 0, nStatic: 0, cap: 0 };

  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function tex(gl, internal, format, type) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, TEXW, S.rows);
    return { t, format, type };
  }
  function upload(gl, tx, data, first = 0, count = S.cap) {
    // rows [r0, r1) covering splats [first, first + count)
    const r0 = Math.floor(first / TEXW), r1 = Math.ceil((first + count) / TEXW), ch = 4;
    gl.activeTexture(gl.TEXTURE7);                                  // a scratch unit: units 0-4 keep their sampler bindings
    gl.bindTexture(gl.TEXTURE_2D, tx.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r0, TEXW, r1 - r0, tx.format, tx.type, data.subarray(r0 * TEXW * ch, r1 * TEXW * ch));
  }

  /** Parse a binary little-endian 3DGS .ply into typed arrays (activated: exp scale, sigmoid opacity, unit quaternion). */
  function parsePly(buf) {
    const bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, 1 << 16));
    let e0 = -1;                                                    // byte offset of "end_header" + its line break
    for (let i = 0; i + 10 < bytes.length && e0 < 0; i++) if (bytes[i] === 101 && String.fromCharCode(...bytes.subarray(i, i + 10)) === 'end_header') e0 = i;
    if (e0 < 0) throw new Error('.ply header without end_header');
    const end = e0 + 10 + (bytes[e0 + 10] === 13 ? 2 : 1), hdr = new TextDecoder('latin1').decode(bytes.subarray(0, end)).replace(/\r/g, '');
    if (!hdr.startsWith('ply') || !/format binary_little_endian 1\.0/.test(hdr)) throw new Error('not a binary little-endian .ply');
    const els = hdr.split('\nelement ').slice(1).map(b => b.split('\n'));
    if (els[0][0].split(' ')[0] !== 'vertex') throw new Error('.ply: the vertex element must come first');
    const n = +els[0][0].split(' ')[1], vprops = els[0].slice(1).filter(l => l.startsWith('property '));
    if (vprops.some(l => !/^property (float|float32) \w+$/.test(l))) throw new Error('.ply: non-float vertex properties are not supported');
    const props = vprops.map(l => l.split(' ')[2]);
    for (const k of ['x', 'y', 'z', 'opacity', 'scale_0', 'rot_0', 'f_dc_0']) if (!props.includes(k)) throw new Error(`.ply lacks ${k}`);
    if (buf.byteLength < end + n * props.length * 4) throw new Error('.ply body shorter than the header says');
    const stride = props.length, f = new Float32Array(buf.slice(end, end + n * stride * 4)), at = Object.fromEntries(props.map((p, i) => [p, i]));
    const nRest = props.filter(p => p.startsWith('f_rest_')).length, deg = nRest >= 45 ? 3 : nRest >= 24 ? 2 : nRest >= 9 ? 1 : 0, nb = (deg + 1) ** 2;
    const pos = new Float32Array(n * 3), opa = new Float32Array(n), cov = new Float32Array(n * 6), sh = new Float32Array(n * nb * 3);
    const rest = Array.from({ length: (nb - 1) * 3 }, (_, k) => at[`f_rest_${k}`]);
    for (let i = 0; i < n; i++) {
      const o = i * stride;
      pos[i * 3] = f[o + at.x]; pos[i * 3 + 1] = f[o + at.y]; pos[i * 3 + 2] = f[o + at.z];
      opa[i] = 1 / (1 + Math.exp(-f[o + at.opacity]));
      const sx = Math.exp(f[o + at.scale_0]), sy = Math.exp(f[o + at.scale_1]), sz = Math.exp(f[o + at.scale_2]);
      let w = f[o + at.rot_0], x = f[o + at.rot_1], y = f[o + at.rot_2], z = f[o + at.rot_3];
      const l = Math.hypot(w, x, y, z) || 1; w /= l; x /= l; y /= l; z /= l;
      const R = [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
                 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
                 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
      const M = [R[0] * sx, R[1] * sy, R[2] * sz, R[3] * sx, R[4] * sy, R[5] * sz, R[6] * sx, R[7] * sy, R[8] * sz];
      const c = i * 6;
      cov[c] = M[0] * M[0] + M[1] * M[1] + M[2] * M[2]; cov[c + 1] = M[0] * M[3] + M[1] * M[4] + M[2] * M[5]; cov[c + 2] = M[0] * M[6] + M[1] * M[7] + M[2] * M[8];
      cov[c + 3] = M[3] * M[3] + M[4] * M[4] + M[5] * M[5]; cov[c + 4] = M[3] * M[6] + M[4] * M[7] + M[5] * M[8]; cov[c + 5] = M[6] * M[6] + M[7] * M[7] + M[8] * M[8];
      const s = i * nb * 3;
      sh[s] = f[o + at.f_dc_0]; sh[s + 1] = f[o + at.f_dc_1]; sh[s + 2] = f[o + at.f_dc_2];
      for (let j = 1; j < nb; j++) for (let ch = 0; ch < 3; ch++) sh[s + j * 3 + ch] = f[o + rest[ch * (nb - 1) + j - 1]];
    }
    return { n, deg, nb, pos, opa, cov, sh };
  }

  /** Static edits in world coordinates, selecting splats by an upright cylinder { cyl: { c, up, r, h0, h1 } } (or an
   *  axis-aligned box: [x0, y0, z0, x1, y1, z1]); op: 'delete' | 'tint' (rgb: [r, g, b], amount). */
  function inside(e, x, y, z) {
    if (e.box) { const b = e.box; return x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]; }
    const { c, up, r, h0, h1 } = e.cyl, dx = x - c[0], dy = y - c[1], dz = z - c[2], h = dx * up[0] + dy * up[1] + dz * up[2];
    if (h < h0 || h > h1) return false;
    const rx = dx - h * up[0], ry = dy - h * up[1], rz = dz - h * up[2];
    return rx * rx + ry * ry + rz * rz <= r * r;
  }
  function applyEdits(d, edits = []) {
    for (const e of edits) {
      let hit = 0;
      for (let i = 0; i < d.n; i++) {
        const x = d.pos[i * 3], y = d.pos[i * 3 + 1], z = d.pos[i * 3 + 2];
        if (!inside(e, x, y, z)) continue;
        hit++;
        if (e.op === 'delete') d.opa[i] = 0;
        else if (e.op === 'tint') {               // move the base (DC) colour toward rgb, keep view-dependent detail
          const s = i * d.nb * 3, k = e.amount ?? 1, lum = (SH_C0 * (d.sh[s] + d.sh[s + 1] + d.sh[s + 2])) / 3 + 0.5;
          for (let ch = 0; ch < 3; ch++) {
            const base = SH_C0 * d.sh[s + ch] + 0.5, target = lum * e.rgb[ch] * 2;
            d.sh[s + ch] = ((base + (target - base) * k) - 0.5) / SH_C0;
          }
        }
      }
      e.hit = hit;
    }
    return edits.map(e => e.hit);
  }

  /** ablate (analysis only): 'fb8' 8-bit blending, 'sigma3' fixed 3σ extent, 'clamp' per-splat colour clamp, 'alpha99'. */
  async function init(url, { edits = [], extraCap = 0, w, h, ablate = [] } = {}) {
    const ab = new Set(ablate); S.ab = ab;
    const buf = await (await fetch(url)).arrayBuffer();
    const d = parsePly(buf);
    const hits = applyEdits(d, edits);
    const canvas = document.getElementById('c'); canvas.width = w; canvas.height = h;
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('no WebGL2');
    S.gl = gl; S.d = d; S.nStatic = d.n; S.cap = d.n + extraCap; S.rows = Math.ceil(S.cap / TEXW); S.w = w; S.h = h;
    const vs = ab.has('sigma3') ? VS.replace('sqrt(2.0 * max(0.0, log(255.0 * cen.w))) * sqrt(lam)', '3.0 * sqrt(lam)') : VS;
    const fs = ab.has('alpha99') ? FS.replace('min(0.999,', 'min(0.99,') : FS;
    const P = gl.createProgram(); gl.attachShader(P, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(P, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(P);
    if (!gl.getProgramParameter(P, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(P));
    gl.useProgram(P); S.P = P;
    S.center = new Float32Array(S.rows * TEXW * 4); S.covA = new Float32Array(S.rows * TEXW * 4); S.covB = new Float32Array(S.rows * TEXW * 4); S.color = new Float32Array(S.rows * TEXW * 4);
    for (let i = 0; i < d.n; i++) {
      S.center.set([d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2], d.opa[i]], i * 4);
      S.covA.set([d.cov[i * 6], d.cov[i * 6 + 1], d.cov[i * 6 + 2], d.cov[i * 6 + 3]], i * 4);
      S.covB[i * 4] = d.cov[i * 6 + 4]; S.covB[i * 4 + 1] = d.cov[i * 6 + 5];
    }
    S.tCenter = tex(gl, gl.RGBA32F, gl.RGBA, gl.FLOAT); upload(gl, S.tCenter, S.center);
    S.tCovA = tex(gl, gl.RGBA32F, gl.RGBA, gl.FLOAT); upload(gl, S.tCovA, S.covA);
    S.tCovB = tex(gl, gl.RGBA32F, gl.RGBA, gl.FLOAT); upload(gl, S.tCovB, S.covB);
    S.tColor = tex(gl, gl.RGBA32F, gl.RGBA, gl.FLOAT);
    [['uCenter', S.tCenter], ['uCovA', S.tCovA], ['uCovB', S.tCovB], ['uColor', S.tColor]].forEach(([u, t], k) => {
      gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t.t); gl.uniform1i(gl.getUniformLocation(P, u), k);
    });
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const la = gl.getAttribLocation(P, 'aCorner'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
    S.idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S.idxBuf); gl.bufferData(gl.ARRAY_BUFFER, S.cap * 4, gl.DYNAMIC_DRAW);
    const li = gl.getAttribLocation(P, 'aIndex'); gl.enableVertexAttribArray(li); gl.vertexAttribIPointer(li, 1, gl.UNSIGNED_INT, 0, 0); gl.vertexAttribDivisor(li, 1);
    S.depth = new Float32Array(S.cap); S.keys = new Uint32Array(S.depth.buffer); S.idx = new Uint32Array(S.cap); S.tmp = new Uint32Array(S.cap);
    S.cnt = new Uint32Array(65536);
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no EXT_color_buffer_float');
    const f32blend = !!gl.getExtension('EXT_float_blend');
    S.fbTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, S.fbTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texStorage2D(gl.TEXTURE_2D, 1, f32blend ? gl.RGBA32F : gl.RGBA16F, w, h);
    S.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, S.fbTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('float framebuffer incomplete');
    S.R = gl.createProgram(); gl.attachShader(S.R, compile(gl, gl.VERTEX_SHADER, RVS)); gl.attachShader(S.R, compile(gl, gl.FRAGMENT_SHADER, RFS)); gl.linkProgram(S.R);
    gl.useProgram(S.R); gl.uniform1i(gl.getUniformLocation(S.R, 'uImg'), 4); gl.useProgram(P);
    S.fbFormat = f32blend ? 'RGBA32F' : 'RGBA16F';
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, w, h);
    return { n: d.n, deg: d.deg, hits, framebuffer: S.fbFormat };
  }

  /** Extra splats for this frame (procedural objects): [{ p: [x,y,z], cov: [6], rgb: [r,g,b] (0..1), a }]. */
  function setExtra(extra = []) {
    const n0 = S.nStatic, m = Math.min(extra.length, S.cap - n0);
    for (let k = 0; k < S.cap - n0; k++) S.center[(n0 + k) * 4 + 3] = 0;
    for (let k = 0; k < m; k++) {
      const e = extra[k], i = n0 + k;
      S.center.set([e.p[0], e.p[1], e.p[2], e.a], i * 4); S.covA.set([e.cov[0], e.cov[1], e.cov[2], e.cov[3]], i * 4);
      S.covB[i * 4] = e.cov[4]; S.covB[i * 4 + 1] = e.cov[5];
      S.color.set([e.rgb[0], e.rgb[1], e.rgb[2], 1], i * 4);
    }
    if (S.cap > n0) for (const t of [[S.tCenter, S.center], [S.tCovA, S.covA], [S.tCovB, S.covB]]) upload(S.gl, t[0], t[1], n0, S.cap - n0);
    S.nExtra = m;
  }

  /** Render one view. cam: { R: 9 row-major world→camera, t: 3, fx, fy, cx, cy }. Returns ms timings. */
  function render(cam, extra) {
    const gl = S.gl, d = S.d, t0 = performance.now();
    if (gl.isContextLost()) throw new Error('WebGL context lost');
    if (extra) setExtra(extra);
    else if (S.nExtra) setExtra([]);                                // a frame without extras draws none
    const R = cam.R, T = cam.t;
    const C = [-(R[0] * T[0] + R[3] * T[1] + R[6] * T[2]), -(R[1] * T[0] + R[4] * T[1] + R[7] * T[2]), -(R[2] * T[0] + R[5] * T[1] + R[8] * T[2])];
    const nb = d.nb, sh = d.sh, col = S.color, n = d.n;
    for (let i = 0; i < n; i++) {                                    // view-dependent colour (3DGS SH convention)
      const px = d.pos[i * 3], py = d.pos[i * 3 + 1], pz = d.pos[i * 3 + 2];
      let x = px - C[0], y = py - C[1], z = pz - C[2]; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      const s = i * nb * 3;
      for (let ch = 0; ch < 3; ch++) {
        let v = SH_C0 * sh[s + ch];
        if (nb > 1) {
          v += -SH_C1 * y * sh[s + 3 + ch] + SH_C1 * z * sh[s + 6 + ch] - SH_C1 * x * sh[s + 9 + ch];
          if (nb > 4) {
            const xx = x * x, yy = y * y, zz = z * z, xy = x * y, yz = y * z, xz = x * z;
            v += SH_C2[0] * xy * sh[s + 12 + ch] + SH_C2[1] * yz * sh[s + 15 + ch] + SH_C2[2] * (2 * zz - xx - yy) * sh[s + 18 + ch]
              + SH_C2[3] * xz * sh[s + 21 + ch] + SH_C2[4] * (xx - yy) * sh[s + 24 + ch];
            if (nb > 9) {
              v += SH_C3[0] * y * (3 * xx - yy) * sh[s + 27 + ch] + SH_C3[1] * xy * z * sh[s + 30 + ch] + SH_C3[2] * y * (4 * zz - xx - yy) * sh[s + 33 + ch]
                + SH_C3[3] * z * (2 * zz - 3 * xx - 3 * yy) * sh[s + 36 + ch] + SH_C3[4] * x * (4 * zz - xx - yy) * sh[s + 39 + ch]
                + SH_C3[5] * z * (xx - yy) * sh[s + 42 + ch] + SH_C3[6] * x * (xx - 3 * yy) * sh[s + 45 + ch];
            }
          }
        }
        col[i * 4 + ch] = S.ab.has('clamp') ? Math.min(1, Math.max(0, v + 0.5)) : v + 0.5;
      }
      col[i * 4 + 3] = 1;
    }
    upload(gl, S.tColor, col, 0, S.cap);
    const t1 = performance.now();
    const total = n + (S.nExtra || 0), ctr = S.center;
    for (let i = 0; i < total; i++) {                                // camera-space depth; far first after the sort
      const z = R[6] * ctr[i * 4] + R[7] * ctr[i * 4 + 1] + R[8] * ctr[i * 4 + 2] + T[2];
      S.depth[i] = z > 0 ? z : 0;
    }
    radixDesc(total);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.idxBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, S.idx.subarray(0, total));
    const t2 = performance.now();
    gl.uniformMatrix3fv(gl.getUniformLocation(S.P, 'uR'), false, [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]);
    gl.uniform3fv(gl.getUniformLocation(S.P, 'uT'), T);
    gl.uniform4fv(gl.getUniformLocation(S.P, 'uK'), [cam.fx, cam.fy, cam.cx, cam.cy]);
    gl.uniform2fv(gl.getUniformLocation(S.P, 'uView'), [S.w, S.h]);
    const bg = cam.bg || [0, 0, 0];
    const fb8 = S.ab.has('fb8');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb8 ? null : S.fb); gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, total); gl.disable(gl.BLEND);
    if (!fb8) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(S.R); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.useProgram(S.P); }
    gl.finish();
    const err = gl.getError(); if (err) throw new Error(`WebGL error 0x${err.toString(16)}`);
    return { sh_ms: t1 - t0, sort_ms: t2 - t1, draw_ms: performance.now() - t2, splats: total };
  }

  // two-pass LSD radix sort of S.keys (positive float bits order like the floats), descending, into S.idx
  function radixDesc(n) {
    const keys = S.keys, cnt = S.cnt; let src = S.idx, dst = S.tmp;
    for (let i = 0; i < n; i++) src[i] = i;
    for (const shift of [0, 16]) {
      cnt.fill(0);
      for (let i = 0; i < n; i++) cnt[0xffff - ((keys[src[i]] >>> shift) & 0xffff)]++;
      let sum = 0; for (let b = 0; b < 65536; b++) { const c = cnt[b]; cnt[b] = sum; sum += c; }
      for (let i = 0; i < n; i++) { const k = src[i]; dst[cnt[0xffff - ((keys[k] >>> shift) & 0xffff)]++] = k; }
      const t = src; src = dst; dst = t;
    }
    if (src !== S.idx) S.idx.set(src.subarray(0, n));
  }

  window.SPLAT = { init, render, png: () => document.getElementById('c').toDataURL('image/png'), jpg: q => document.getElementById('c').toDataURL('image/jpeg', q) };
})();
