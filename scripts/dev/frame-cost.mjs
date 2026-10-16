// time full renders (incl. readback) of a project at given times, brush vs flat: node frame-cost.mjs <project> <t,t,...>
import { openStudio } from '../../lib/page.mjs';
const [proj, ts] = [process.argv[2], (process.argv[3] || '1').split(',').map(Number)];
for (const medium of ['brush', 'flat']) {
  const { browser, page } = await openStudio(proj, { softGl: true, medium, scale: .5 });
  const out = []; for (const t of ts) { const t0 = Date.now(); await page.evaluate(t => window.renderAt(t, 'image/jpeg', .9), t); out.push(Date.now() - t0); }
  console.log(medium.padEnd(6), ts.map((t, i) => `${t}s:${out[i]}ms`).join('  ')); await browser.close();
}
