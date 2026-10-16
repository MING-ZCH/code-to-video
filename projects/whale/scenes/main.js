// whale: image-input generalization test (9 s). Shots/reads: ../STORYBOARD.md.
//   A 0–3 the hand slams the button, screens die · B 3–6 one screen survives, the whale asks "?", the hand freezes
//   C 6–9 calm: screens return, the hand waves, the whale smiles
(() => {
  const C = { wall: '#351225', wallDk: '#1b0a1c', red: '#832129', crimson: '#5d1f27', cream: '#c8a697', teal: '#2E6F78', tealLt: '#7FC4C0', whale: '#5B7FD6', whaleLt: '#9DB7F0', screen: '#0E1A2A' };
  const BT = n => OFF + n * BEAT, SLAM = BT(3), SURVIVOR = 5, CALM = 6.0, WAVE0 = 6.9, SMILE = 7.8;
  const MON = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) MON.push([300 + c * 440, 190 + r * 300]);   // monitor centres
  const offAt = i => i === SURVIVOR ? 2.95 : 2.0 + .11 * i;          // A: screens die one by one; the survivor flickers back in B
  const onAt = i => CALM + .12 + .09 * i;                           // C: back on, one by one

  // the whale: side (swimming) or front (facing us); s = scale, phase drives the tail
  function whale(x, y, s, o = {}) {
    push(); translate(x, y); scale(s * (o.flip ? -1 : 1), s); boilSeed(o.key || 'whale');
    if (o.view === 'front') {
      paint(ellPts(0, 0, 70, 58, 26, 1), { wash: C.whale, fill: C.whaleLt, fillOp: 70, tex: .4, ink: PAL.ink, sw: .9 });
      paint(ellPts(0, 22, 46, 26, 20), { wash: C.whaleLt, ink: null });
      for (const sx of [-1, 1]) paint(ellPts(sx * 24, -10, 9, o.happy ? 4 : 12, 12), { wash: PAL.ink, ink: null });
      inkLine(o.happy ? [[-18, 22], [0, 34], [18, 22]] : [[-10, 28], [10, 28]], .8, PAL.ink, 'ink', .6);
      for (const sx of [-1, 1]) paint(ribbon([[sx * 66, 10], [sx * 92, 30 + 6 * Math.sin((o.phase || 0) * 6 + sx)]], 16, 6), { wash: C.whale, ink: PAL.ink, sw: .7 });
    } else {
      const ph = o.phase || 0, tail = 14 * Math.sin(ph * 7);
      paint(ribbon([[-70, 0], [-20, -10], [40, -6], [90, tail * .4]], 70, 18), { wash: C.whale, fill: C.whaleLt, fillOp: 60, tex: .4, ink: PAL.ink, sw: .9 });
      paint([[86, tail * .4], [116, -22 + tail], [104, tail * .4], [116, 24 + tail]], { wash: C.whale, ink: PAL.ink, sw: .8 });
      paint(ellPts(-42, -6, 7, 7, 10), { wash: PAL.ink, ink: null });
      inkLine([[-70, 10], [-40, 16]], .6, PAL.ink, 'inkfine', .5);
    }
    pop();
  }
  // the operator's hand (screen-right), palm centre (x, y); curl 0..1 folds the fingers; rot tilts the wrist
  function hand(x, y, curl = 0, rot = 0) {
    boilSeed('hand'); push(); translate(x, y); rotate(rot);
    paint(rrPts(60, -40, 420, 120, 50), { wash: '#E8B48A', fill: '#C98E68', fillOp: 50, ink: PAL.ink, sw: 1.1 });                  // the arm/sleeve root
    paint(rrPts(380, -70, 300, 180, 40), { wash: '#4A5A80', ink: PAL.ink, sw: 1.1 });                                               // sleeve cuff
    paint(ellPts(0, 0, 100, 80, 24), { wash: '#F0C29C', fill: '#D9A07A', fillOp: 50, ink: PAL.ink, sw: 1.1 });
    for (let f = 0; f < 4; f++) { const a = Math.PI + (f - 1.5) * .28, L = 120 - 12 * Math.abs(f - 1.5), c = curl * (.9 + .1 * f);
      const p0 = [Math.cos(a) * 80, Math.sin(a) * 60], p1 = [p0[0] + Math.cos(a + c) * L * .55, p0[1] + Math.sin(a + c) * L * .55], p2 = [p1[0] + Math.cos(a + 2 * c) * L * .45, p1[1] + Math.sin(a + 2 * c) * L * .45];
      paint(ribbon([p0, p1, p2], 34, 26), { wash: '#F0C29C', ink: PAL.ink, sw: .9 }); }
    paint(ribbon([[10, 60], [-40, 110], [-90, 120 - 40 * curl]], 36, 26), { wash: '#F0C29C', ink: PAL.ink, sw: .9 });             // thumb
    pop();
  }
  function room(t, calm) {
    const wall = mixCol(C.wall, '#16323A', calm), alarm = 1 - calm;
    boilSeed('wall'); paint(rectPts(-400, -300, W + 800, H + 600), { wash: wall, fill: C.wallDk, fillOp: 60, bleed: .15, tex: .5, ink: null });
    boilSeed('console'); paint(rectPts(-400, 760, W + 800, 500), { wash: mixCol(C.crimson, '#1E3E44', calm), ink: PAL.ink, sw: 1 });
    MON.forEach(([mx, my], i) => {
      const on = (t < offAt(i) || (i === SURVIVOR && t > 3.05 && t < CALM) || t > onAt(i)) && !(i === SURVIVOR && t > 2.95 && t < 3.05 && frac(t * 24) < .5);
      boilSeed('mon' + i); paint(rrPts(mx - 190, my - 120, 380, 240, 14), { wash: '#2A1A26', ink: PAL.ink, sw: 1 });
      paint(rrPts(mx - 170, my - 104, 340, 208, 8), { wash: on ? mixCol('#3A1420', '#123C44', calm) : C.screen, ink: null });
      if (on) whale(mx + 60 * Math.sin(t * 1.3 + i), my + 10 * Math.sin(t * 2 + i * 2), .9, { phase: t + i, flip: i % 2 === 1, key: 'w' + i });
    });
    if (alarm > 0) { boilSeed('alarm'); glow(960, 40, 500 + 120 * pulse(t, 4), '#FF4A4A', .6 * alarm); }
    boilSeed('button'); paint(ellPts(1540, 790, 110, 40, 24), { wash: '#2A1A26', ink: PAL.ink, sw: 1 });
    paint(ellPts(1540, 770 + 10 * seg(t, SLAM - .03, SLAM) * (1 - seg(t, SLAM + .2, SLAM + .5)), 80, 34, 24), { wash: '#C8433A', fill: '#F2786A', fillOp: 50, ink: PAL.ink, sw: 1 });
  }

  function shotA(t, lt, dur) {
    camBegin(960, 520, 1 + .03 * lt);
    room(t, 0);
    const up = kf(t, [[0, 900], [.6, 520], [SLAM - .25, 420], [SLAM, 700], [SLAM + .4, 690], [dur, 640]], easeOut);   // rises (anticipation), slams on the beat
    hand(1600 + 60 * (1 - seg(t, 0, .6)), up, .55, -.15);
    camEnd();
    if (t > SLAM && t < SLAM + .1) flash(.25, '#FFB0A0');
    if (lt < .3) flash(1 - lt / .3, '#FF6A5A');                                               // transition in: alarm flash
    // transition out: cut on action — the survivor's flicker carries into B's push-in
  }
  function shotB(t, lt, dur) {
    const [mx, my] = MON[SURVIVOR], pin = ease(seg(t, 3.0, 4.6)), back = ease(seg(t, 5.15, 5.6));
    camBegin(lerp(960, mx, pin) + 320 * back, lerp(520, my, pin) + 180 * back, lerp(1.09, 2.4, pin) * lerp(1, .62, back));   // starts at A's last zoom (c2v reads R4: it popped 3%)
    room(t, 0);
    const turnK = seg(t, 3.8, 4.15), view = turnK < .5 ? 'side' : 'front';
    whale(mx, my, 1.15 * (1 + .25 * backOut(seg(t, 3.8, 4.2))), { view, phase: t, key: 'hero', happy: false });
    if (t > 4.7) emote('?', mx + 110, my - 80, 70, seg(t, 4.7, 4.9), t - 4.7);
    const freeze = seg(t, 5.3, 5.7);
    hand(1600, lerp(560, 540, freeze), lerp(.55, .95, freeze), -.15 + .05 * Math.sin(t * 30) * (1 - freeze) * (t > 5.3 ? 1 : 0));
    camEnd();
    if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6, [C.teal, C.tealLt]);                // transition out: teal brush wipe (the alarm clears)
  }
  function shotC(t, lt, dur) {
    const [mx, my] = MON[SURVIVOR], pull = ease(seg(t, CALM, 7.2));
    camBegin(lerp(mx + 120, 960, pull), lerp(my + 120, 520, pull), lerp(1.6, 1.0, pull));
    room(t, ease(seg(t, CALM, 6.8)));
    whale(mx, my, 1.15, { view: 'front', phase: t, key: 'hero', happy: t > SMILE });
    if (t > SMILE) { const k = seg(t, SMILE, SMILE + 1.1); boilSeed('bubble'); paint(heartPts(mx + 40, my - 60 - 90 * k, 18 + 10 * k), { wash: '#F28AA0', washOp: 255 * (1 - k * k), ink: PAL.ink, sw: .6 }); }
    const wave = t > WAVE0 ? .35 * Math.sin((t - WAVE0) * 9) * Math.exp(-(t - WAVE0) * .6) : 0;
    hand(1600 - 40 * seg(t, WAVE0 - .3, WAVE0), 560 - 260 * easeOut(seg(t, WAVE0 - .5, WAVE0)),   // lifted well clear of the button: a wave, not another slam
       lerp(.95, .05, seg(t, WAVE0 - .4, WAVE0)), -.6 * seg(t, WAVE0 - .4, WAVE0) + wave);
    const at = toScreen(mx, my);
    camEnd();
    if (lt < .3) brushWipe(.5 + lt / .6, [C.teal, C.tealLt]);                                  // transition in: the wipe drags off
    if (lt > dur - .6) iris(...at, lerp(1300, 0, easeIn(seg(lt, dur - .6, dur - .05))));      // transition out: iris on the whale
  }
  shots([[0, shotA], [3.0, shotB], [CALM, shotC]]);
  sound([{ at: 0, kind: 'rumble', dur: 5.8, gain: .35 }, ...beats(0, 2, 'x.......x.......', 'hat', { gain: .3 }), { at: SLAM, kind: 'thud', gain: .9 }, { at: SLAM, kind: 'click', gain: .6 },
    ...[0, 1, 2, 3, 4, 6, 7].map(i => ({ at: offAt(i), kind: 'pop', freq: 260 - 15 * i, gain: .2 })), { at: 4.72, kind: 'tone', freq: 420, glide: 640, dur: .35, wave: 'sine', gain: .3 },
    { at: CALM, kind: 'pad', notes: ['D3', 'A3', 'F#4'], dur: 2.8, gain: .22, attack: .6 }, { at: SMILE, kind: 'chime', note: 'A6', gain: .3 }]);
})();
