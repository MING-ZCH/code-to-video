// page.mjs: open studio.html?project=<name> in headless Chrome and hand back the page (for check / inspection).
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome, gpuFlags, baseFlags } from './chrome.mjs';

export async function openStudio(project, o = {}) {
  const chrome = findChrome(o.chrome); if (!chrome) throw new Error('Chrome not found: pass --chrome=<path> or set CHROME_PATH');
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 0, args: [...baseFlags(), ...gpuFlags({ softGl: o.softGl, gpuAngle: o.gpuAngle })] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(resolve(o.root || '.', 'studio.html')).href + `?render&project=${encodeURIComponent(project)}${o.medium ? '&medium=' + o.medium : ''}${o.scale ? '&scale=' + o.scale : ''}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  return { browser, page, errors };
}
