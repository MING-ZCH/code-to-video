// mux_cuts_audio.mjs: lay a source's original sound under a rendered cut, from the same cut list the scene uses.
//   node scripts/dev/mux_cuts_audio.mjs <project> <source media> [out.mp4]
// Reads PROJECT.params.cuts ([[srcStart, srcEnd], …]), lead and tail (seconds of silence before and after).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const [name, src, out = `projects/${name}/out/video_sound.mp4`] = process.argv.slice(2);
const ctx = {}; vm.runInNewContext(readFileSync(`projects/${name}/project.js`, 'utf8') + '\nthis.PROJECT = PROJECT;', ctx);
const { cuts, lead = 0, tail = 0 } = ctx.PROJECT.params;
const parts = [`aevalsrc=0:d=${lead}:s=48000:c=stereo[l]`, `aevalsrc=0:d=${tail}:s=48000:c=stereo[t]`];
cuts.forEach(([a, b], i) => parts.push(`[1:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.03,afade=t=out:st=${(b - a - 0.03).toFixed(3)}:d=0.03[c${i}]`));
parts.push(`[l]${cuts.map((_, i) => `[c${i}]`).join('')}[t]concat=n=${cuts.length + 2}:v=0:a=1[a]`);
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', `projects/${name}/out/video.mp4`, '-i', src, '-filter_complex', parts.join(';'),
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', out], { encoding: 'utf8' });
if (r.status) { console.error(r.stderr); process.exit(1); }
console.log('wrote ' + out);
