// which part of glow() is nondeterministic? render a frame 4× under each variant and compare hashes.
import { openStudio } from '../../lib/page.mjs';
import { createHash } from 'node:crypto';
const { browser, page } = await openStudio(process.argv[2] || 'night', { softGl: true });
const t = +(process.argv[3] || 1.8), sha = async () => createHash('sha1').update(await page.evaluate(t => window.renderAt(t, 'image/png'), t)).digest('hex').slice(0, 10);
const variants = {
  original: 'glow = window._g0 || glow; window._g0 = glow;',
  flushOnly: 'glow = () => flushBrush();',
  imageOnly: `glow = (x, y, r, col = '#FFC766', a = 1) => { if (a <= 0 || r < 1) return; const c = color(col), rr = r * (1 + jit(.03)); push(); blendMode(ADD); tint(red(c), green(c), blue(c), 150 * clamp(a)); image(glowTex, x - rr, y - rr, 2 * rr, 2 * rr); noTint(); blendMode(BLEND); pop(); };`,
  staticImage: 'glow = window._g0; if (!window._gi) { window._gi = glowTex.get(); glowTex = window._gi; }',
  addEllipses: `glow = (x, y, r, col = '#FFC766', a = 1) => { if (a <= 0 || r < 1) return; flushBrush(); const c = color(col), rr = r * (1 + jit(.03)); push(); blendMode(ADD); noStroke(); for (const [k, al] of [[1, .05], [.75, .08], [.5, .12], [.3, .16], [.15, .2]]) { fill(red(c), green(c), blue(c), 255 * al * clamp(a)); ellipse(x, y, 2 * rr * k, 2 * rr * k, 48); } blendMode(BLEND); pop(); };`,
  shaderQuad: `if (!window._gs) window._gs = createShader(
     'precision highp float; attribute vec3 aPosition; attribute vec2 aTexCoord; uniform mat4 uModelViewMatrix; uniform mat4 uProjectionMatrix; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0); }',
     'precision highp float; varying vec2 vUv; uniform vec4 uCol; void main() { float d = length(vUv - .5) * 2.; float a = d < .18 ? mix(1., .8, d / .18) : d < .45 ? mix(.8, .32, (d - .18) / .27) : d < .75 ? mix(.32, .08, (d - .45) / .3) : d < 1. ? mix(.08, 0., (d - .75) / .25) : 0.; gl_FragColor = vec4(uCol.rgb * a * uCol.a, a * uCol.a); }');
   glow = (x, y, r, col = '#FFC766', a = 1) => { if (a <= 0 || r < 1) return; flushBrush(); const c = color(col), rr = r * (1 + jit(.03));
     push(); blendMode(ADD); noStroke(); shader(window._gs); window._gs.setUniform('uCol', [red(c) / 255, green(c) / 255, blue(c) / 255, 150 / 255 * clamp(a)]); rect(x - rr, y - rr, 2 * rr, 2 * rr); resetShader(); blendMode(BLEND); pop(); };`,
  none: 'glow = () => {};',
};
await page.evaluate(() => { window._g0 = glow; });
for (const [name, code] of Object.entries(variants)) {
  await page.evaluate(c => { (0, eval)(c.replace('window._g0 || glow', 'window._g0')); }, code);
  const h = []; for (let i = 0; i < 4; i++) h.push(await sha());
  console.log(name.padEnd(10), h.join(' '), new Set(h).size === 1 ? 'STABLE' : 'VARIES');
}
await browser.close();
