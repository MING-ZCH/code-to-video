// main.js: double exposure inside an exact silhouette. See STORYBOARD.md.
(() => {
  const SIL = ASSET_META.silhouette, SH = 1110, SW = SH * SIL.w / SIL.h, SX = W - SW - 40, SY = H - SH + 20;   // the head, right side, facing left
  const RECT = [SX, SY, SW, SH], RIM = [SX - 5, SY - 5, SW + 10, SH + 10];
  const DIS = P('dissolve'), PLANT0 = ASSET_META.plant.start;

  // cover-fit a w×h frame into the silhouette's box, scaled by z around a focus point (fx, fy in 0..1 of the frame)
  function cover(fw, fh, z, fx, fy) {
    const s = Math.max(SW / fw, SH / fh) * z, w = fw * s, h = fh * s;
    return [SX + SW * .5 - w * fx, SY + SH * .55 - h * fy, w, h];
  }

  function main(t, lt, dur) {
    push(); resetMatrix(); translate(-W / 2, -H / 2); noStroke(); fill(P('bg')); rect(0, 0, W, H); pop();
    const mix = ease(seg(t, DIS, DIS + 2.2));
    // a dark rim a few pixels outside the outline, so the head reads against the pale ground
    footage('silhouette', 0, ...RIM, { mask: { name: 'silhouette', rect: RIM }, tint: [.16, .14, .12], alpha: .9 });
    // first exposure: the moor (man, poles, fog), pushing in slowly
    if (mix < 1) {
      const m = ASSET_META.moor, [x, y, w, h] = cover(m.w, m.h, 1.25 + .06 * seg(t, 0, DIS + 2), .52, .46);
      footage('moor', Math.min(t, m.dur - .05), x, y, w, h, { mask: { name: 'silhouette', rect: RECT }, tint: [.78, .76, .72] });
    }
    // second exposure: the plant; its towers sit on the shoulder line and the steam climbs into the head
    if (mix > 0) {
      const p = ASSET_META.plant, [x, y, w, h] = cover(p.w, p.h, 1.6, .44, .343);
      footage('plant', Math.min(t - DIS + .5, p.dur - .05), x, y, w, h, { mask: { name: 'silhouette', rect: RECT }, alpha: mix, tint: [.82, .8, .76] });
    }
    grade({ t, filmic: .3, contrast: 1.12, sat: P('sat'), temp: .28, tint: .05, vignette: .55, grain: .085, scratch: P('scratch'), halation: .08,
      fade: Math.max(1 - ease(seg(lt, 0, .8)), ease(seg(lt, dur - .8, dur))) });
  }
  shots([[0, main]]);
})();
