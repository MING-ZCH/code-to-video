// profiling aid: time one frame with ?skip=<part> for each part (needs a scene that reads ?skip)
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path'; import { pathToFileURL } from 'node:url';
import { findChrome, gpuFlags, baseFlags } from '../../lib/chrome.mjs';
const [proj, t, parts] = [process.argv[2], +process.argv[3], (process.argv[4] || '').split(',')];
const b = await puppeteer.launch({ executablePath: findChrome(), headless: true, protocolTimeout: 0, args: [...baseFlags(), ...gpuFlags({ softGl: true })] });
for (const skip of ['', ...parts]) {
  const p = await b.newPage(); await p.goto(pathToFileURL(resolve('studio.html')).href + `?render&project=${proj}&scale=.5&skip=${skip}`, { waitUntil: 'networkidle0', timeout: 120000 }); await p.waitForFunction('window.ready === true');
  await p.evaluate(t => window.renderAt(t, 'image/jpeg', .9), t); const t0 = Date.now(); await p.evaluate(t => window.renderAt(t, 'image/jpeg', .9), t);
  console.log(`skip=${skip || '(none)'}`.padEnd(14), Date.now() - t0, 'ms'); await p.close();
}
await b.close();
