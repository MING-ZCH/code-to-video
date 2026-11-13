// main.js: real footage as the picture; the code decides time, framing, type, grade and style. See STORYBOARD.md.
(() => {
  const CLIP = 'highbar', SRC_W = 1920, SRC_H = 1088, MCI = ASSET_META.highbar_mci;
  const ST0 = 7.0;                                     // source second where the film starts
  const SLOW = P('slow'), ZOOM = P('zoom');
  const RAMP_IN = 4.2, HELD = 4.7, RAMP_OUT = 6.6, BACK = 7.0;   // shot-B timing (video seconds)
  const A_END = 2.6, B_END = 7.4;
  const ZH = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif', EN = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
  // one source-time curve for the whole film: .5× under the title, 1×, ramp to SLOW at the peak, back to 1×
  const SPEED = [[0, .5], [2.2, .5], [2.8, 1], [RAMP_IN, 1], [HELD, SLOW], [RAMP_OUT, SLOW], [BACK, 1]];
  const srcT = t => ST0 + speedRamp(t, SPEED);

  // the picture: footage under a hand-held virtual camera, pushed in around the bar during the slow motion
  function picture(t) {
    const hh = handheld(t, 1, 3), push = kf(t, [[RAMP_IN, 1], [HELD + .3, ZOOM], [RAMP_OUT, ZOOM * 1.03], [BACK + .4, 1]]);
    camBegin(960 + hh.x, 540 + hh.y - (push - 1) * 260, push * 1.04, hh.r);   // 1.04: margin so the drift never shows an edge
    // the slow-motion window comes from a 96 fps motion-interpolated cut of the same source (c2v assets --interp=4)
    const st = srcT(t), mci = st >= MCI.start + .05 && st < MCI.start + MCI.dur - .05;
    footage(mci ? 'highbar_mci' : CLIP, mci ? st - MCI.start : st, 0, (H - SRC_H) / 2, SRC_W, SRC_H, { smooth: !mci });
    camEnd();
  }
  function finish(t, o = {}) {
    grade({ t, filmic: .55, contrast: 1.06, sat: P('sat'), temp: P('temp'), exposure: o.exposure ?? 0, defocus: o.defocus ?? 0,
      bloom: .22, bloomThr: .72, halation: .18, ca: 1.2, vignette: .4, grain: .045, letterbox: .055, fade: o.fade ?? 0 });
  }
  function rule(x, y, w, k, col) { if (k > 0) paint(rectPts(x - w * k / 2, y - 1.5, w * k, 3), { wash: col, ink: null }); }

  function title(t, lt, dur) {
    picture(t);
    const focus = 1 - ease(seg(lt, 1.9, dur + .5));                 // the focus pull runs on into shot B
    finish(t, { defocus: 26 * focus, exposure: -1.6 * focus, fade: 1 - ease(seg(lt, 0, .7)) });
    const zIn = ease(seg(lt, .2, 1.4)), eIn = ease(seg(lt, 1.1, 2.0)), out = ease(seg(lt, 2.1, dur));
    textBlock(P('title_zh'), 960, 500 - 30 * out, { size: 104, weight: 600, align: 'center', font: ZH, color: '#F6F1E7', alpha: zIn * (1 - out), screen: true });
    LETTERS.at(-1) && Object.assign(LETTERS.at(-1), { blur: 18 * (1 - zIn), track: 26 - 12 * zIn, glow: 'rgba(255,220,160,.35)', glowR: 30 });
    rule(960, 578 - 30 * out, 420, eIn * (1 - out), P('accent'));
    textBlock(P('title_en'), 960, 622 - 30 * out, { size: 30, weight: 500, align: 'center', font: EN, color: '#E9E2D4', alpha: eIn * (1 - out), screen: true });
    LETTERS.at(-1) && Object.assign(LETTERS.at(-1), { track: 10 + 6 * (1 - eIn), blur: 6 * (1 - eIn) });
  }

  function slowmo(t, lt, dur) {
    // transition: none in the picture: the footage is continuous and the title's focus pull carries on into this shot
    picture(t);
    finish(t, { defocus: 26 * (1 - ease(seg(t, A_END - .7, A_END + .5))), exposure: -1.6 * (1 - ease(seg(t, A_END - .7, A_END + .5))) });
    // slow-motion tag, top right, only while the picture runs slower than 0.6×
    const on = ease(seg(t, HELD - .3, HELD)) * (1 - ease(seg(t, RAMP_OUT, RAMP_OUT + .3)));
    if (on > .01 && SLOW < .99) {
      textBlock(`${SLOW}×`, 1760, 120, { size: 38, weight: 600, align: 'center', font: EN, color: P('accent'), alpha: on, screen: true });
      paint(ellPts(1700, 120, 7, 7, 16), { wash: P('accent'), washOp: 255 * on * (.6 + .4 * Math.sin(t * 8)), ink: null });
    }
    // lower third: what and who (the credit the licence asks for)
    const lt3 = ease(seg(lt, .5, 1.1)) * (1 - ease(seg(lt, 2.6, 3.1)));
    if (lt3 > .01) {
      const shade = { glow: 'rgba(10,8,6,.85)', glowR: 14 };
      rule(90 + 150 * lt3, 902, 300, lt3, P('accent'));
      textBlock('Gymnastics Australia', 90, 868, { size: 36, weight: 600, font: EN, color: '#FBF7EE', alpha: lt3, screen: true }); Object.assign(LETTERS.at(-1), shade);
      textBlock('LauraHale · CC BY-SA 3.0 · Wikimedia Commons', 90, 934, { size: 22, weight: 500, font: EN, color: '#ECE6DA', alpha: lt3, screen: true }); Object.assign(LETTERS.at(-1), shade);
    }
  }

  function painted(t, lt, dur) {
    // transition: restyle cross-fade (stylize k 0 → 1 over the first second) on continuous footage
    picture(t);
    const k = ease(seg(lt, 0, 1.0)), style = P('style');
    if (style !== 'none') stylize(style, { k, t: onTwos(t), r: 8 });
    finish(t, { fade: ease(seg(lt, dur - .6, dur)) });
    // title echo: a red seal stamped bottom right (the ink-painting convention), the move's name set vertically in it
    const e = ease(seg(lt, 1.0, 1.25)) * (1 - ease(seg(lt, dur - .7, dur - .2))), name = P('title_zh').split('·').pop().trim();
    if (e > .01) {
      const s = 1 + .25 * (1 - backOut(seg(lt, 1.0, 1.3))), h = 66 * [...name].length + 30, x = 1716, y = 880 - h;
      push(); translate(x + 45, y + h / 2); scale(s); translate(-(x + 45), -(y + h / 2));
      boilSeed('seal'); paint(rrPts(x, y, 90, h, 10, 2), { wash: '#B8322A', washOp: 235 * e, ink: null });
      pop();
      textBlock([...name].join('\n'), x + 45, y + 48, { size: 56, weight: 600, align: 'center', font: ZH, color: '#F7EFE2', alpha: e, lineH: 1.18, screen: true });
    }
  }

  shots([[0, title], [A_END, slowmo], [B_END, painted]]);
})();
