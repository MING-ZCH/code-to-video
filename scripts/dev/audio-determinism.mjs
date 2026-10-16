// Renders the project's score in two fresh pages and compares the WAVs byte-for-byte.
//   LD_LIBRARY_PATH=… node scripts/dev/audio-determinism.mjs <project> [chrome]
import puppeteer from 'puppeteer-core';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const proj = process.argv[2] || 'p1-media';
let chrome = process.argv[3];
if (!chrome) { const d = `${process.env.HOME}/.cache/ms-playwright`, sh = readdirSync(d).find(n => n.startsWith('chromium_headless_shell')); chrome = `${d}/${sh}/chrome-headless-shell-linux-arm64/chrome-headless-shell`; }
const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const url = pathToFileURL(resolve('studio.html')).href + `?render&project=${proj}`, h = [];
for (let run = 0; run < 2; run++) {
  const p = await b.newPage(); await p.goto(url, { waitUntil: 'networkidle0' }); await p.waitForFunction('window.ready === true');
  const t0 = Date.now(), { wav, events } = await p.evaluate(() => window.renderAudio(DUR));
  h.push(createHash('sha1').update(wav).digest('hex').slice(0, 12)); console.log(`run ${run}: ${events} events, ${Date.now() - t0} ms, ${h[run]}`); await p.close();
}
console.log(h[0] === h[1] ? 'AUDIO DETERMINISTIC' : 'AUDIO DIFFERS'); await b.close(); process.exit(h[0] === h[1] ? 0 : 2);
