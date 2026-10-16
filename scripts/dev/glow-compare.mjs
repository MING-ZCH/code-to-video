// render the same frames with the textured glow and the shader-quad glow; save PNG crops side by side for a look check
import { openStudio } from '../../lib/page.mjs';
import { writeFileSync } from 'node:fs';
const shots = [['umbrella', 12.3, [1100, 0, 800, 450]], ['night', 1.8, [300, 650, 800, 450]]];
const quad = readQuad();
for (const [p, t, crop] of shots) {
  const { browser, page } = await openStudio(p, { softGl: true });
  const grab = async tag => { const url = await page.evaluate(async (t, c) => { await window.renderAt(t); const cv = document.createElement('canvas'); cv.width = c[2]; cv.height = c[3];
    cv.getContext('2d').drawImage(document.getElementById('out'), c[0], c[1], c[2], c[3], 0, 0, c[2], c[3]); return cv.toDataURL('image/png'); }, t, crop);
    writeFileSync(`/tmp/glow_${p}_${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); };
  await grab('texture'); await page.evaluate(q => (0, eval)(q), quad); await grab('quad'); await browser.close();
}
function readQuad() { const s = (await_import => await_import)(null); return `window._gs = createShader('precision highp float; attribute vec3 aPosition; attribute vec2 aTexCoord; uniform mat4 uModelViewMatrix; uniform mat4 uProjectionMatrix; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0); }',
  'precision highp float; varying vec2 vUv; uniform vec4 uCol; void main() { float d = length(vUv - .5) * 2.; float a = d < .18 ? mix(1., .8, d / .18) : d < .45 ? mix(.8, .32, (d - .18) / .27) : d < .75 ? mix(.32, .08, (d - .45) / .3) : d < 1. ? mix(.08, 0., (d - .75) / .25) : 0.; gl_FragColor = vec4(uCol.rgb * a * uCol.a, a * uCol.a); }');
  glow = (x, y, r, col = '#FFC766', a = 1) => { if (a <= 0 || r < 1) return; flushBrush(); const c = color(col), rr = r * (1 + jit(.03)); push(); blendMode(ADD); noStroke(); shader(window._gs); window._gs.setUniform('uCol', [red(c) / 255, green(c) / 255, blue(c) / 255, 150 / 255 * clamp(a)]); rect(x - rr, y - rr, 2 * rr, 2 * rr); resetShader(); blendMode(BLEND); pop(); };`; }
