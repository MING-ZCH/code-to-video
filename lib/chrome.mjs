// chrome.mjs: find a Chrome/Chromium and pick GPU flags; shared by render.mjs and bin/c2v.mjs.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';

function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir).filter(n => /^chromium(_headless_shell)?-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1]))
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-headless-shell-linux-arm64/chrome-headless-shell'])
      out.push(`${dir}/${n}/${sub}`);
  return out;
}
export function findChrome(explicit) {
  const c = [explicit, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', ...playwrightChromes()];
  return c.find(p => p && existsSync(p));
}
// --soft-gl: SwiftShader (no GPU). --gpu-angle=vulkan|gl-egl: headless Linux + NVIDIA. Otherwise the platform default.
export const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
export function gpuFlags({ softGl, gpuAngle } = {}) {
  if (softGl) return ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  if (gpuAngle) { if (!ANGLE[gpuAngle]) throw new Error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); return ANGLE[gpuAngle]; }
  return process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
}
export const baseFlags = () => [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--allow-file-access-from-files', '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
