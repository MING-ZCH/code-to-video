// night: RSI round 1 case 1 (before/after on the deepseek baseline). Shots, reads, props and framing: ../STORYBOARD.md.
//   A 0–2.5 the whale conducts the night city · B 2.5–6 we stop reading (book shut, lamp off, windows dark)
//   C 6–9.6 sunrise, the whale brings an answer · D 9.6–13.7 the answer doesn't fit
(() => {
  const C = { night: '#1C1F45', nightLt: '#2C3266', bld: '#2A2D52', win: '#F2C14E', whale: '#5B7FD6', whaleLt: '#9DB7F0', room: '#3A2F45', desk: '#6E4A35',
              paper: '#F3EBDC', peach: '#F2B38A', sun: '#FFD27A', red: '#C8433A', teal: '#5FC7C0', coin: '#F2C14E', screen: '#0E1A2A' };
  const BT = n => OFF + n * BEAT, G = 900;
  const SURGE = BT(1), CLOSE = BT(4), LAMP = BT(5), RISE = 6.0, DROP0 = 7.4, LAND = BT(10), CRACK = BT(11), RED = BT(12);
  const WIN = [1320, 620], GAP = [960, 812];
  // ---------- characters (the whale and the operator's hand, from the whale case) ----------
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
  // ---------- set ----------
  function city(t, k = 1, lit = 1, warm = 0) {                       // k: scale of the windows' lights, lit: share still on
    for (let i = 0; i < 14; i++) {
      const x = -300 + i * 190 + 40 * hash(i), h = 220 + 300 * hash(i + 5), w = 150 + 40 * hash(i + 9);
      boilSeed('bld' + i); paint(rectPts(x, G - h, w, h + 40), { wash: mixCol(C.bld, '#6E5A70', warm), ink: PAL.ink, sw: .7 });
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
        const id = i * 31 + r * 3 + c, on = hash(id) < .55 && hash(id + 400) < lit;
        if (on) paint(rectPts(x + 18 + c * 44, G - h + 30 + r * 46, 22, 26), { wash: C.win, washOp: 220 * k, ink: null });
      }
    }
    boilSeed('ground'); paint(rectPts(-600, G, 3200, 400), { wash: '#141634', ink: null });
  }
  // the streams: cars (teal) along the avenue and coins (gold) along the bridge, as dots flowing; speed surges on the fin flick
  function streams(t, surge) {
    const ph = t * .6 + 1.4 * easeOut(seg(t, SURGE, SURGE + .5));
    for (let i = 0; i < 26; i++) { const u = frac(i / 26 + ph * .3), x = lerp(-200, 2200, u), y = G - 20 + 8 * Math.sin(u * 20);
      boilSeed('car' + i); paint(ellPts(x, y, 26 + 22 * surge, 11, 12), { wash: C.teal, ink: PAL.ink, sw: .5 }); glow(x, y, 60 + 40 * surge, '#9FF2E6', .5 + .4 * surge); }
    for (let i = 0; i < 18; i++) { const u = frac(i / 18 - ph * .25), x = lerp(2100, -100, u), y = 640 - 120 * Math.sin(u * Math.PI);
      boilSeed('coin' + i); paint(ellPts(x, y, 18 + 8 * surge, 18 + 8 * surge, 12), { wash: C.coin, ink: PAL.ink, sw: .6 }); glow(x, y, 50, '#FFE7A0', .3 + .4 * surge); }
  }
  function room(t, warm = 0, lampOn = 1, outsideLit = 1, red = 0) {
    boilSeed('wall'); paint(rectPts(-200, -200, W + 400, G + 200), { wash: mixCol(mixCol(C.room, '#7A5A6A', warm), C.red, red * .5), fill: '#2A2236', fillOp: 50, tex: .5, ink: null });
    // the window onto the city
    boilSeed('winFrame'); paint(rectPts(1180, 280, 540, 380), { wash: mixCol(C.night, C.peach, warm), ink: PAL.ink, sw: 1.2 });
    for (let i = 0; i < 9; i++) {                                   // a small skyline inside the window frame only
      const x = 1190 + i * 58, h = 70 + 150 * hash(i + 70); boilSeed('wb' + i);
      paint(rectPts(x, 660 - h, 50, h), { wash: mixCol(C.bld, '#7A6A80', warm), ink: null });
      for (let r = 0; r < 4; r++) if (hash(i * 7 + r + 300) < .6 * outsideLit) paint(rectPts(x + 14, 660 - h + 14 + r * 30, 14, 14), { wash: C.win, ink: null });
    }
    for (const x of [1180, 1450, 1720]) inkLine([[x, 280], [x, 660]], 1, PAL.ink, 'ink', 0);
    boilSeed('floor'); paint(rectPts(-200, G, W + 400, 400), { wash: mixCol('#2A2236', '#6E5A60', warm), ink: null });
    boilSeed('desk'); paint(rectPts(300, G - 60, 1320, 70), { wash: C.desk, ink: PAL.ink, sw: 1 });
    boilSeed('lamp'); paint([[560, 880], [640, 880], [610, 640], [590, 640]], { wash: '#4A3A30', ink: PAL.ink, sw: .9 });
    paint([[500, 640], [700, 640], [650, 560], [550, 560]], { wash: lampOn > .5 ? '#F2C14E' : '#7A6A50', ink: PAL.ink, sw: 1 });
    if (lampOn > 0) glow(600, 700, 420, '#FFE7A0', .7 * lampOn);
  }
  const BOOK = [960, 760, 400, 130];                                 // centre x, y, open width, page height: also its focus box
  function book(t, closed) {                                         // an open book seen from above at an angle; closed 0..1 folds the right page over
    boilSeed('book'); const [x, y, , ph] = BOOK, hw = 200;
    paint([[x - hw, y - ph / 2 + 10], [x, y - ph / 2], [x, y + ph / 2], [x - hw, y + ph / 2 + 10]], { wash: C.paper, ink: PAL.ink, sw: .9 });
    for (let l = 0; l < 6; l++) inkLine([[x - hw + 20, y - ph / 2 + 25 + l * 16], [x - 20, y - ph / 2 + 18 + l * 16]], .5, '#8A7A6A', 'inkfine', 0);
    paint(ellPts(x - hw / 2, y - 6, 40, 26, 14), { wash: '#9DB7F0', ink: PAL.ink, sw: .5 });                  // a little whale drawn in the report
    const side = closed < .5 ? 1 : -1, ww = hw * Math.abs(1 - 2 * closed), lift = 40 * Math.sin(Math.PI * closed);
    paint([[x, y - ph / 2], [x + side * ww, y - ph / 2 + 10 - lift], [x + side * ww, y + ph / 2 + 10 - lift], [x, y + ph / 2]], { wash: closed > .5 ? '#7A4A6A' : C.paper, ink: PAL.ink, sw: .9 });
    if (closed < .5) for (let l = 0; l < 6; l++) inkLine([[x + 20, y - ph / 2 + 18 + l * 16], [x + ww - 20, y - ph / 2 + 25 + l * 16 - lift]], .5, '#8A7A6A', 'inkfine', 0);
  }
  function piecePts(cx, cy, s, flip = 1) {                           // a jigsaw piece with one tab (flip = which side the tab is on)
    const P = [[-1, -1], [1, -1], [1, -.25]]; for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI; P.push([1 + .45 * Math.cos(a) * flip, .25 * Math.sin(a) * 1.4 + 0]); }
    P.push([1, .25], [1, 1], [-1, 1]); return P.map(([x, y]) => [cx + x * s, cy + y * s]);
  }
  function puzzle(t, crack) {
    boilSeed('puzzle'); paint(rectPts(GAP[0] - 270, GAP[1] - 90, 540, 170), { wash: '#B9A27E', ink: PAL.ink, sw: .9 });
    for (const dx of [-180, 180]) paint(piecePts(GAP[0] + dx, GAP[1] - 5, 70, dx < 0 ? 1 : -1), { wash: dx < 0 ? '#E8D6B8' : '#D9C49E', ink: PAL.ink, sw: .9 });
    paint(rectPts(GAP[0] - 70, GAP[1] - 75, 140, 140), { wash: '#2B2233', ink: null });          // the gap
  }

  // ---------- A ----------
  function shotA(t, lt, dur) {
    const pin = easeIn(seg(lt, dur - .5, dur));
    camBegin(lerp(960, WIN[0], pin), lerp(520, WIN[1], pin), lerp(.9, 3.2, pin));
    boilSeed('sky'); paint(rectPts(-600, -400, 3200, G + 400), { wash: C.night, fill: C.nightLt, fillOp: 50, bleed: .2, tex: .4, ink: null });
    city(t); streams(t, 1 - Math.exp(-Math.max(0, t - SURGE) * 3) * (t > SURGE ? 1 : 0));
    const fin = Math.sin(t * 4) * .2 + (t > SURGE - .15 && t < SURGE + .3 ? .5 * Math.sin(seg(t, SURGE - .15, SURGE + .3) * Math.PI) : 0);
    glow(980, 300, 380, '#9DB7F0', .5); whale(980, 300 + 10 * Math.sin(t * 1.5), 2.6, { phase: t + fin, key: 'hero' });
    focus('whale', 980, 300, 2.6 * 240, 2.6 * 90, { min: 150 }); focus('streams', 960, G - 120, 2200, 280, { min: 200, words: ['streams'] });
    boilSeed('litWin'); paint(rectPts(WIN[0] - 60, WIN[1] - 45, 120, 90), { wash: C.win, ink: PAL.ink, sw: .6 });   // the window we push into
    camEnd();
    if (lt < .45) iris(...toScreenAt(960, 520, .9, 980, 300), lerp(0, 1500, easeIn(lt / .45)));   // transition in: iris opens on the whale
    // transition out: push-in through the lit window into the room (a different space)
  }
  const toScreenAt = (cx, cy, z, x, y) => [W / 2 + (x - cx) * z, H / 2 + (y - cy) * z];
  // ---------- B ----------
  function shotB(t, lt, dur) {
    camBegin(lerp(1000, 960, ease(seg(lt, 0, 1.2))), lerp(700, 760, ease(seg(lt, 0, 1.2))), lerp(1.4, 1.15, easeOut(seg(lt, 0, .8))));
    const lampOn = 1 - seg(t, LAMP, LAMP + .1), lit = 1 - seg(t, LAMP + .1, 5.9);
    room(t, 0, lampOn, lit); glow(1450, 470, 160, '#9DB7F0', .6); whale(1450, 470, .35, { phase: t, key: 'far' });
    const closed = ease(seg(t, CLOSE - .35, CLOSE + .1)); book(t, closed);
    const reach = seg(t, 3.0, CLOSE - .35), away = seg(t, LAMP + .3, 5.9);
    const hx = lerp(1500, lerp(1100, 700, seg(t, CLOSE + .1, LAMP - .1)), reach) + 600 * away, hy = lerp(700, lerp(780, 600, seg(t, CLOSE + .1, LAMP - .1)), reach);
    hand(hx, hy, .3, -.2);
    focus('book', BOOK[0], BOOK[1], BOOK[2] * (1 - .5 * closed), BOOK[3], { min: 120 }); focus('hand', hx + 150, hy, 300, 200, { min: 120, offscreenOk: t > LAMP + .3 }); focus('lamp', 600, 600, 200, 100);
    camEnd();
    if (lt < .25) flash(1 - lt / .25, C.win);                                                      // transition in: the window's light, from A's push
    // transition out: the sunrise — C opens from dark
  }
  // ---------- C ----------
  function shotC(t, lt, dur) {
    const tilt = ease(seg(t, DROP0, 9.6));
    camBegin(lerp(1250, 1000, tilt), lerp(420, 700, tilt), lerp(1.2, 1.1, tilt));
    const warm = ease(seg(t, RISE, 7.0));
    room(t, warm, 0, .2 + .8 * warm, 0);
    boilSeed('sun'); glow(1600, lerp(700, 360, warm), 260, C.sun, .8 * warm); paint(ellPts(1600, lerp(700, 360, warm), 50, 50, 20), { wash: C.sun, ink: null });
    book(t, 1); puzzle(t, 0); focus('gap', GAP[0], GAP[1], 160, 160, { min: 60 });
    const wy = 440 + 8 * Math.sin(t * 1.6), k = seg(t, DROP0, LAND), [px, py] = arcPt([1450, wy + 90], GAP, -120, easeIn(k) * .5 + k * .5);
    whale(1450, wy, .8, { phase: t, key: 'far', view: 'front', happy: true }); focus('whale', 1450, wy, 140, 100, { min: 100 });
    if (t >= DROP0 - .4) { boilSeed('piece'); paint(piecePts(px, py, 58, -1), { wash: '#9DB7F0', ink: PAL.ink, sw: 1 }); focus('piece', px, py, 150, 120, { min: 90, held: true }); }
    camEnd();
    if (lt < .4) flash(1 - lt / .4, '#1B1630');                                                     // transition in: from dark, the sunrise
    // transition out: cut on action — the piece keeps descending into D's close framing
  }
  // ---------- D ----------
  function shotD(t, lt, dur) {
    const back = ease(seg(t, RED, RED + .6));
    camBegin(lerp(GAP[0], 1150, back), lerp(GAP[1] - 40, 640, back), lerp(2.1, 1.25, back));
    const red = seg(t, RED, RED + .5);
    room(t, 1, 0, 1, red); book(t, 1); puzzle(t, 0);
    const k = seg(t, DROP0, LAND), [px, py] = t < LAND ? arcPt([1450, 530], GAP, -120, easeIn(k) * .5 + k * .5) : [GAP[0] + 6 * spring(t, LAND, 5, 30), GAP[1] - 18];   // sits proud: it doesn't go in
    const tilt = t > LAND ? .12 * backOut(seg(t, LAND, LAND + .3)) : 0;
    boilSeed('piece'); push(); translate(px, py); rotate(tilt); paint(piecePts(0, 0, 58, -1), { wash: mixCol('#9DB7F0', C.red, red), ink: PAL.ink, sw: 1 }); pop();
    if (t > CRACK) { const c = seg(t, CRACK, CRACK + .25); boilSeed('crack'); inkLine([[px - 40, py - 50], [px - 5, py - 10], [px + 10, py + 5], [px - 15, py + 30], [px + 20, py + 55]].slice(0, 2 + Math.round(c * 3)), 1.6, PAL.ink, 'ink', 0); }
    focus('piece', px, py, 150, 130, { min: 150, held: true }); focus('gap', GAP[0], GAP[1], 160, 160, { min: 150 });
    const wy = 440 + 8 * Math.sin(t * 1.6);
    whale(1450, wy, .8, { phase: t, key: 'far', view: 'front', happy: false }); focus('whale', 1450, wy, 140, 100, { min: 100 });
    if (t > RED + .2) emote('sweat', 1530, wy - 70, 40, seg(t, RED + .2, RED + .4), t - RED);
    const at = toScreen(px, py);
    camEnd();
    if (lt > dur - .5) iris(...at, lerp(1300, 0, easeIn(seg(lt, dur - .5, dur - .05))));          // transition out: iris on the cracked piece
  }
  shots([[0, shotA], [2.5, shotB], [6.0, shotC], [9.6, shotD]]);
})();
