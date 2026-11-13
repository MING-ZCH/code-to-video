// commons-preview.mjs: contact sheets of Wikimedia Commons videos from their small transcodes, to pick footage before
// fetching the full file with `c2v assets`.  node scripts/dev/commons-preview.mjs <out_dir> "<File title>" ...
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const UA = 'code-to-video-assets/0.1 (https://github.com/MING-ZCH/code-to-video)';
const [out, ...titles] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

async function get(url) {
  for (let k = 0; k < 6; k++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) return r; } catch { }
    await sleep(1500 * 2 ** k);
  }
  throw new Error('failed ' + url);
}

for (const [i, t] of titles.entries()) {
  const d = await (await get(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + t)}&prop=videoinfo&viprop=derivatives|url&format=json`)).json();
  const v = Object.values(d.query.pages)[0].videoinfo?.[0];
  if (!v) { console.log(`${i}: no videoinfo for ${t}`); continue; }
  const der = (v.derivatives || []).find(x => /^(360|480)p/.test(x.transcodekey)) || { src: v.url };
  const f = `${out}/v${i}.webm`;
  writeFileSync(f, Buffer.from(await (await get(der.src)).arrayBuffer()));
  const dur = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout || 10;
  const step = Math.max(.5, dur / 18);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `fps=1/${step.toFixed(3)},scale=240:-2,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black,tile=6x3`, '-frames:v', '1', `${out}/v${i}.jpg`]);
  console.log(`${i}: ${t} · ${dur.toFixed(1)} s · step ${step.toFixed(2)} s → ${out}/v${i}.jpg`);
}
