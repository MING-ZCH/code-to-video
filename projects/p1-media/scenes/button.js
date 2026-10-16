// button.js: "The button" (P1 media test, 6 s).
//   A 0–2.5   dusk field, a big red button on a post. Clawd notices it (eyes first), thinks, can't resist, presses it.
//             brush medium. Sound: footstep thuds, a click on the press.
//   B 2.5–6   cut on action: far away on the horizon the shader explosion rises; shockwave reaches the camera,
//             Clawd is blown back a step (scared), then the cap glows and Clawd goes starstruck. Iris out on Clawd.
//             Sound: boom on the flash, rumble bed, whoosh with the shockwave, chime on the starstruck take.
(() => {
  const DUSK = '#E9A07A', HAZE = '#C98DA0', FIELD = '#7C9A5E';
  function field(t, horizonY, zoom) {
    boilSeed('sky'); paint(rectPts(-400, -300, W + 800, H + 600), { wash: '#F2C59B', ink: null });
    boilSeed('haze'); paint(ellPts(W / 2, horizonY + 40, W * .9, 260, 30, 8), { fill: HAZE, fillOp: 120, bleed: .25, tex: .5, ink: null });
    boilSeed('sun'); glow(W * .72, horizonY - 60, 260, '#FFD08A', .6); paint(ellPts(W * .72, horizonY - 60, 70, 70, 24, 1), { wash: '#FFE6B0', ink: null });
    boilSeed('ground'); paint(rectPts(-400, horizonY, W + 800, H, 4), { wash: FIELD, fill: mixCol(FIELD, PAL.night, .3), fillOp: 90, bleed: .05, tex: .5, ink: PAL.ink, sw: .8 });
    for (let i = 0; i < 14; i++) {      // grass, stable per tuft, swaying on the beat
      boilSeed('tuft' + i); const x = hash(i) * (W + 400) - 200, y = horizonY + 60 + hash(i + 9) * 340, s = wob(t, .6, hash(i) * 3) * 6;
      for (const k of [-1, 0, 1]) inkLine([[x + k * 8, y], [x + k * 12 + s, y - 26 - 10 * hash(i + k)]], .7, mixCol(FIELD, PAL.cream, .4), 'inkfine', .4);
    }
  }
  function button(x, y, press, S = 1.35, V = .75) { // a mushroom button on a post; press 0..1 sinks the cap; S = size
    boilSeed('post'); paint(rrPts(x - 18 * S, y - 170 * V, 36 * S, 170 * V, 8), { wash: '#8A7A6A', ink: PAL.ink, sw: 1 });
    boilSeed('base'); paint(rrPts(x - 70 * S, y - 200 * V, 140 * S, 44 * S, 14), { wash: '#5E5560', ink: PAL.ink, sw: 1.1 });
    boilSeed('cap'); paint(ellPts(x, y - 200 * V - (14 - 18 * press) * S, 60 * S, (34 - 10 * press) * S, 28, 1), { wash: '#D8433A', fill: '#F2786A', fillOp: 60, ink: PAL.ink, sw: 1.1 });
  }

  const BX = 1350, GY = 860;
  function shotA(t, lt, dur) {
    camBegin(lerp(980, 1080, ease(seg(lt, 0, 2.5))), 560, lerp(1.0, 1.12, ease(seg(lt, .2, 2.4))));
    field(t, 600, 1);
    const press = seg(lt, 1.95, 2.05) - seg(lt, 2.2, 2.45);
    button(BX, GY, clamp(press));
    const walk = stroll(lt, .9, 1.7, 820, 1120, 26);
    const mood = emotions(lt, [[0, 'neutral', { lookX: .2 }], [.45, 'thinking', { lookX: 1 }], [1.0, 'mischief', { lookX: 1 }], [2.05, 'surprised', { lookX: 1 }]]);
    const reach = seg(lt, 1.75, 1.95) - seg(lt, 2.15, 2.4);
    clawd(walk.x, GY, 26, { ...mood, ...walk, view: walk.view === 'front' && lt > 1.7 ? 'q' : walk.view, dy: mood.dy + walk.dy, aL: lerp(-.3, .55, ease(reach)) });
    focus('button', BX, GY - 150, 170, 120); focusClawd('clawd', walk.x, GY, 26);
    camEnd();
    if (lt < .4) iris(960, 560, lerp(0, 1400, easeIn(lt / .4)));
    if (lt > dur - .12) flash(easeIn(seg(lt, dur - .12, dur)));          // transition out: the blast's light floods the frame
  }

  const BOOM = 2.5, HZ = 600;                       // the blast lands exactly on the cut (flash cut)
  function shotB(t, lt, dur) {
    const k = seg(t, BOOM, 5.6), wave = seg(t, 3.15, 3.75);
    const [sx, sy] = shakeXY(t, 14 * Math.exp(-Math.max(0, t - 3.2) * 4) * (t > 3.2 ? 1 : 0));
    camBegin(960 + sx, 540 + sy, 1);
    field(t, HZ, 1);
    camEnd();
    // the blast, far away on the horizon, painted by a shader over the brush layers
    if (t >= BOOM) shade('explosion', { t: onTwos(t), k, at: [W * .64, HZ + 10], r: 230, c1: '#FFF6D0', c2: '#F07A2C', c3: '#6E5D68' });
    if (wave > 0 && wave < 1) shade('shockwave', { k: wave, at: [W * .64, HZ], r: 1900, c1: '#FFF3C4' });
    camBegin(960 + sx, 540 + sy, 1);
    const blown = 40 * backOut(seg(t, 3.25, 3.6));
    const mood = emotions(t, [[2.05, 'surprised', { lookX: .9, view: 'q' }],   // same key as shot A: no second take on the cut
       [3.3, 'scared', { lookX: .9, view: 'q' }], [4.3, 'starstruck', { lookX: .9, view: 'q' }]]);
    clawd(560 - blown, GY + 40, 30, { ...mood, flip: false, aL: .3 + .9 * seg(t, 4.3, 4.6), aR: -.2 });
    const at = toScreen(560 - blown, GY + 40 - 120);
    camEnd();
    if (lt < .25) flash(1 - easeOut(lt / .25));                          // transition in: the flash drains away
    if (lt > dur - .7) iris(...at, lerp(1400, 0, easeIn(seg(lt, dur - .7, dur - .05))));
  }
  shots([[0, shotA], [2.5, shotB]]);

  // sound: every hit is tied to the same constants the picture uses
  sound([
    { at: .95, kind: 'thud', gain: .35 }, { at: 1.25, kind: 'thud', gain: .35 }, { at: 1.55, kind: 'thud', gain: .35 },
    { at: 2.0, kind: 'click', gain: .7 }, { at: 2.02, kind: 'pop', freq: 500, gain: .4 },
    { at: BOOM, kind: 'boom', dur: 3.2, gain: 1 }, { at: BOOM + .1, kind: 'rumble', dur: 2.6, gain: .5 },
    { at: 3.1, kind: 'whoosh', dur: .5, gain: .6 }, { at: 4.3, kind: 'chime', note: 'E6', gain: .35 },
    { at: 0, kind: 'pad', notes: ['A2', 'E3', 'C4'], dur: 2.4, gain: .25 },
    { at: 4.4, kind: 'pad', notes: ['F2', 'C3', 'A3', 'E4'], dur: 1.2, gain: .25 },
  ]);
})();
