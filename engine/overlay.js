// overlay.js: optional karaoke lyric bar (off by default).
//
// The ANIMATION_GUIDE rule is "lyrics are not text": act the line instead. Some formats want the words on screen anyway
// (PDoomVideo's MV has a karaoke bar). Then turn it on per project, and keep it OUT of the picture: it is an overlay
// composited after the frame, under the paper grain, never painted into the scene and never counted as scene text.
//
//   PROJECT.karaoke = { lines: [[t0, t1, 'line one'], [t0, t1, 'line two', 'second language'], ...],
//                       y: .9, size: 40, ink: '#2B2233', fill: '#FFF5E2', hi: '#D97757', font: '"Shantell Sans", sans-serif' }
//   Words highlight left to right across [t0, t1] (character-proportional). An optional 4th field adds a smaller line.

function karaokeAt(t) {
  const K = PROJECT.karaoke; if (!K || !K.lines) return null;
  for (const L of K.lines) if (t >= L[0] - .12 && t < L[1] + .25) return L;
  return null;
}
function drawKaraoke(c, t) {
  if (window.LOOP) return;                                   // loops are model sheets and tests: no lyrics
  const K = PROJECT.karaoke, L = karaokeAt(t); if (!L) return;
  const [t0, t1, txt, sub] = L, size = K.size || 40, y = H * (K.y ?? .9), font = K.font || '"Permanent Marker", "PingFang SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif';
  const fadeIn = clamp((t - (t0 - .12)) / .12), fadeOut = 1 - clamp((t - t1) / .25), a = Math.min(fadeIn, fadeOut);
  c.save(); c.globalAlpha = a; c.font = `${size}px ${font}`; c.textBaseline = 'middle';
  const w = c.measureText(txt).width, sw = sub ? (c.font = `${size * .55}px ${font}`, c.measureText(sub).width) : 0;
  c.font = `${size}px ${font}`;
  const bw = Math.max(w, sw) + size * 1.4, bh = size * (sub ? 2.2 : 1.55), x0 = W / 2 - bw / 2, yb = y - size * .78;
  // a painted-looking pill: slightly irregular edge from hash(), stable per line
  c.fillStyle = K.fill || 'rgba(255,245,226,.92)'; c.strokeStyle = K.ink || PAL.ink; c.lineWidth = 3;
  c.beginPath(); const r = bh / 2, seed = Math.round(t0 * 100);
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, ang = u * TAU, ex = Math.cos(ang), ey = Math.sin(ang);
    const px = W / 2 + ex * (bw / 2 - r) + ex * r * (1 + (hash(seed + i) - .5) * .04), py = yb + bh / 2 + ey * r * (1 + (hash(seed + i + 50) - .5) * .06);
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath(); c.fill(); c.stroke();
  const k = clamp((t - t0) / Math.max(.01, t1 - t0)), tx = W / 2 - w / 2, ty = yb + size * .78;
  c.textAlign = 'left'; c.fillStyle = K.ink || PAL.ink; c.fillText(txt, tx, ty);
  c.save(); c.beginPath(); c.rect(tx, ty - size, w * k, size * 2); c.clip(); c.fillStyle = K.hi || PAL.clay; c.fillText(txt, tx, ty); c.restore();
  if (sub) { c.font = `${size * .55}px ${font}`; c.textAlign = 'center'; c.fillStyle = K.ink || PAL.ink; c.globalAlpha = a * .8; c.fillText(sub, W / 2, ty + size * .95); }
  c.restore();
}
