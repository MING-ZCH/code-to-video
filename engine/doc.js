// doc.js: document inputs (posters, rich-text cards, memes). Text and the source image are the content here.
//
//   PROJECT.assets = { poster: 'input/poster.png' }   images under the project folder, decoded before the first frame
//   PROJECT.text = 'content'                          a text-native format: lettering is the content, not decoration
//                                                     (check reports it as info instead of a rule-2 warning)
//
// plate(name, src, x, y, w, h, o)  draws a crop of a source image in world space (follows the camera).
//                                   src = [sx, sy, sw, sh] in source pixels, or null for the whole image.
//                                   o.alpha 0..1. Painted marks after it land on top.
// textBlock(text, x, y, o)          typesets text on the lettering layer (crisp, under the paper grain, on top of paint).
//                                   '\n' breaks lines; o.maxW wraps (CJK per character, Latin per word).
//                                   o.size, o.weight, o.color, o.align ('left' | 'center'), o.lineH (× size),
//                                   o.reveal 0..1 types it out character by character. Returns { w, h, lines }.
// marker(x, y, w, h, k, col)        a highlighter stroke that sweeps in left→right as k goes 0→1 (painted, under text).
// DOC_FONT                          the font stack for document text (CJK-safe). Fonts are the machine's: a Mac draws
//                                   PingFang, Linux Noto Sans CJK; frames are deterministic per machine, not across.

const DOC_FONT = '"PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "WenQuanYi Micro Hei", "Helvetica Neue", Arial, sans-serif';
const ASSETS = {};
async function loadAssets() {
  const list = Object.entries((typeof PROJECT !== 'undefined' && PROJECT.assets) || {});
  for (const [name, rel] of list) ASSETS[name] = await loadImage(`projects/${window.PROJECT_NAME}/${rel}`);
  if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready;
}
function plate(name, src, x, y, w, h, o = {}) {
  const img = ASSETS[name]; if (!img) throw new Error(`plate: no asset "${name}" (declare it in PROJECT.assets)`);
  const [sx, sy, sw, sh] = src || [0, 0, img.width, img.height];
  flushBrush();                                         // what was painted so far lands under the plate
  push(); if (o.alpha != null) tint(255, 255 * clamp(o.alpha)); image(img, x, y, w, h, sx, sy, sw, sh); noTint(); pop();
}
const isCJK = ch => /[　-鿿＀-￯]/.test(ch);
function wrapLines(text, font, maxW) {
  const c = letG.drawingContext; c.font = font; const out = [];
  for (const para of String(text).split('\n')) {
    if (!maxW) { out.push(para); continue; }
    const units = []; let word = '';
    for (const ch of [...para]) { if (isCJK(ch) || ch === ' ') { if (word) units.push(word); word = ''; units.push(ch); } else word += ch; }
    if (word) units.push(word);
    let line = '';
    for (const u of units) { const next = line + u; if (line && c.measureText(next).width > maxW) { out.push(line.trimEnd()); line = u === ' ' ? '' : u; } else line = next; }
    out.push(line.trimEnd());
  }
  return out;
}
function textBlock(text, x, y, o = {}) {
  const size = o.size || 40, weight = o.weight || 500, font = `${weight} ${size}px ${o.font || DOC_FONT}`, lh = size * (o.lineH || 1.35);
  const lines = wrapLines(text, font, o.maxW), total = lines.reduce((a, l) => a + [...l].length, 0);
  let left = Math.floor(clamp(o.reveal ?? 1) * total + 1e-6);
  const c = letG.drawingContext; c.font = font; let w = 0;
  lines.forEach((l, i) => {
    const chars = [...l], n = Math.min(chars.length, left); left -= n; w = Math.max(w, c.measureText(l).width);
    if (n > 0) letter(chars.slice(0, n).join(''), x, y + i * lh, size, o.color || PAL.ink,
      { font, align: o.align || 'left', ink: false, alpha: o.alpha, screen: o.screen });
  });
  return { w, h: lines.length * lh, lines };
}
function marker(x, y, w, h, k, col = '#FFE08A') {
  if (k <= 0) return;
  paint(rectPts(x, y, w * clamp(k), h), { wash: col, ink: null });
}
