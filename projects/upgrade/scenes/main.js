// upgrade: case C "after" — the chorus of gpt-6-one-more-upgrade (32–50 s), same audio + lyrics. Shots/reads: ../STORYBOARD.md.
//   A 0–4.7 two upgrades, bonk · B 4.7–9.3 roof off, touch the sky · C 9.3–13.7 the switch, the show · D 13.7–18 lights out, small again
(() => {
  const C = { room: '#252B55', roomLt: '#3A4378', floor: '#3B3F63', pad: '#3A9C98', padLt: '#7FD3C9', gold: '#F2C14E', sky: '#141A3E', metal: '#9AA3B5', metalDk: '#5E6680' };
  const BT = n => OFF + n * BEAT, G = 860, X = 960, CEIL = 300;
  const ZAP1 = BT(2), ZAP2 = BT(6), BONK = ZAP2 + .24, ROOF = 4.9, TOUCH = BT(15), THROW = BT(19), LIGHTS = [20, 21, 22, 23, 24].map(BT),
        OUTS = [26, 27, 28, 29, 30].map(BT), SHRINK0 = 14.8, SHRINK1 = 16.2;
  const sizeAt = t => t < ZAP1 ? 18 : t < ZAP2 ? lerp(18, 30, backOut(seg(t, ZAP1, ZAP1 + .3))) : lerp(30, 56, backOut(seg(t, ZAP2, ZAP2 + .3)));   // 56: the head reaches the lamp

  function room(t, roofUp = 0, warm = 0, withRoof = true) {
    boilSeed('sky'); paint(rectPts(-800, -1800, W + 1600, CEIL + 1800), { wash: C.sky, fill: '#22295A', fillOp: 60, bleed: .2, tex: .4, ink: null });
    for (let i = 0; i < 40; i++) { boilSeed('star' + i); const x = hash(i) * 2600 - 300, y = CEIL - 60 - hash(i + 30) * 1500, tw = .6 + .4 * Math.sin(t * (2 + hash(i + 60) * 2) + i);
      paint(starPts(x, y, 5 + 6 * hash(i + 90) * tw, .35, 4), { wash: '#FFF5E2', washOp: 160 + 90 * tw, ink: null }); }
    boilSeed('walls'); paint(rectPts(-800, CEIL, W + 1600, G - CEIL), { wash: mixCol(C.room, '#5A3A50', warm), fill: C.roomLt, fillOp: 50, bleed: .1, tex: .5, ink: null });
    boilSeed('floor'); paint(rectPts(-800, G, W + 1600, 600), { wash: C.floor, ink: null });
    for (let x = -800; x < W + 800; x += 1600) inkLine([[x, G], [x + 1600, G]], 1, PAL.ink, 'ink', 0);
    // the roof panel: in place until ROOF, then pushed up and flung away on an arc, spinning
    if (withRoof) roofPanel(t);
  }
  function roofPanel(t) {
    // 1) Clawd's head lifts it (it rides on the head as Clawd grows, ROOF-.2 → ROOF+.5); 2) flung up and away (→ ROOF+2.1)
    const lift = t < ROOF + .5 ? Math.max(0, roofHead(t) - (CEIL - 40)) : 0, k = seg(t, ROOF + .5, ROOF + 2.1);
    const r0 = [X, Math.min(CEIL - 40, roofHead(ROOF + .5))], [rx, ry] = t < ROOF + .5 ? [X, Math.min(CEIL - 40, roofHead(t))] : arcPt(r0, [X + 1500, CEIL - 1900], 220, easeIn(k) * .6 + k * .4);
    if (k < 1) { boilSeed('roof'); push(); translate(rx, ry); rotate(1.4 * easeIn(k)); paint(rectPts(-1400, -40, 2800, 80), { wash: '#7A6A8E', fill: '#5E4E72', fillOp: 50, tex: .5, ink: PAL.ink, sw: 1.2 }); for (let b = -1300; b < 1400; b += 260) inkLine([[b, -40], [b, 40]], .8, PAL.ink, 'inkfine', 0); pop(); }
  }
  const bSize = t => lerp(64, 76, ease(seg(t, 4.7, ROOF + .5)));
  const roofHead = t => G - 8 * bSize(t) - .3 * bSize(t) * ease(seg(t, 4.7, ROOF)) - 40;   // head top minus the panel's half-thickness
  function pad(t, glowK) {
    boilSeed('pad'); paint(ellPts(X, G + 12, 260, 46, 32), { wash: '#2A3050', ink: PAL.ink, sw: 1 });
    paint(ellPts(X, G + 6, 220, 34, 32), { wash: mixCol(C.pad, C.padLt, glowK), ink: PAL.ink, sw: .9 });
    if (glowK > .05) glow(X, G, 260 + 220 * glowK, '#9FF2E6', .5 * glowK + .2);
  }
  const zapK = t => Math.max(...[ZAP1, ZAP2].map(z => t >= z ? Math.exp(-(t - z) * 5) : 0));
  function bolt(t, top) {                                         // the zap: a jagged painted bolt from the ceiling to the pad
    const k = zapK(t); if (k < .15) return;
    boilSeed('bolt' + Math.floor(t * 12)); const P = []; for (let i = 0; i <= 8; i++) P.push([X + (i % 2 ? 40 : -40) * (1 - i / 8) + jit(16), lerp(top, G - 20, i / 8)]);
    inkLine(P, 3 * k, '#FFF3B0', 'ink', 0); glow(X, (top + G) / 2, 300, '#FFF3B0', k);
  }
  function lamp(t, swing) {
    boilSeed('lamp'); push(); translate(X + 40, CEIL); rotate(swing);
    inkLine([[0, 0], [0, 90]], .8, PAL.ink, 'inkfine', 0);
    paint([[-50, 90], [50, 90], [30, 60], [-30, 60]], { wash: C.metal, ink: PAL.ink, sw: .9 }); glow(0, 110, 120, '#FFE7A0', .5); pop();
  }

  // ---------- A ----------
  function shotA(t, lt, dur) {
    const u = sizeAt(t), z = lerp(1.55, 1.0, easeOut(seg(t, ZAP2, ZAP2 + .35)));            // hold, then pull back WITH the second growth (never against it)
    camBegin(X, lerp(760, 600, seg(z, 1.55, 1.0)), z);
    room(t); pad(t, .3 + .7 * zapK(t)); bolt(t, CEIL);
    const mood = emotions(t, [[0, 'hopeful', { lookY: -.5 }], [ZAP1 + .05, 'excited'], [BONK, 'surprised', { lookY: -1 }]]);
    const g = ring(t, [ZAP1, ZAP2], 7, 20);
    clawd(X, G, u, { ...mood, sq: (mood.sq || 0) - .25 * g, aL: .3 + .5 * zapK(t), aR: .3 + .5 * zapK(t), emote: t > BONK ? 'stars' : mood.emote, emoteK: t > BONK ? seg(t, BONK, BONK + .2) : mood.emoteK });
    lamp(t, .5 * spring(t, BONK, 3, 9));                             // in front of Clawd: the head bonks it
    focusClawd('clawd', X, G, u); focus('lamp', X + 40, CEIL + 75, 100, 70, { min: 50 });
    camEnd();
    if (lt < .25) flash(1 - lt / .25, '#C9FFF6');                                             // transition in: the pad's zap light
    // transition out: cut on action — the bonk shoves straight up through the roof in B
  }
  // ---------- B ----------
  function shotB(t, lt, dur) {
    const tilt = ease(seg(t, ROOF + .5, 7.4)), u = bSize(t);
    camBegin(X + 160 * tilt, lerp(470, 160, tilt), lerp(.78, .7, tilt));                 // wide enough to see head, roof and sky; tilts up after the roof
    room(t, 0, 0, false); pad(t, .5);
    const reach = ease(seg(t, 6.6, TOUCH)), aR = lerp(1.5, 1.1, reach);
    const mood = emotions(t, [[BONK, 'surprised', { lookY: -1 }], [5.5, 'determined', { lookY: -1 }], [TOUCH - .3, 'starstruck', { lookX: .6, lookY: -1 }]]);
    const shove = ease(seg(t, 4.7, ROOF));
    clawd(X, G, u, { ...mood, aL: lerp(.6, 1.5, shove), aR: lerp(.6, aR, shove), dy: (mood.dy || 0) - .3 * shove });
    roofPanel(t);                                                   // after Clawd: the panel sits ON the head that lifts it
    const tip = [X + (4.9 + .55 * clamp((aR - .7) / .9) + 2.2 * Math.cos(aR)) * u, G - 4.5 * u - 2.2 * Math.sin(aR) * u];
    boilSeed('theStar'); const sk = seg(t, TOUCH, TOUCH + .6), sr = 30 + 46 * backOut(sk) * (1 - .5 * sk);
    glow(tip[0] + 20, tip[1] - 30, 120 + 260 * sk, C.gold, .5 + .5 * sk);
    paint(starPts(tip[0] + 20, tip[1] - 30, sr, .4, 5, t * .5), { wash: C.gold, ink: PAL.ink, sw: .8 });
    if (t > TOUCH - .3) focus('star', tip[0] + 20, tip[1] - 30, 2 * sr, 2 * sr); focusClawd('clawd', X, G, u);
    camEnd();
    if (lt > dur - .2) whipPan(easeIn(seg(lt, dur - .2, dur)), -1, C.room);                   // transition out: whip pan down to the switch
  }
  // ---------- C ----------
  function shotC(t, lt, dur) {
    const u = 56, [sx, sy] = shakeXY(t, t > THROW ? 8 * Math.exp(-(t - THROW) * 8) : 0);   // CLUNK shake
    camBegin(1100 + sx, 600 - 300 * (1 - easeOut(seg(lt, 0, .28))) + sy, .95 + .03 * lt);
    room(t, 1, seg(t, THROW, THROW + 1));
    LIGHTS.forEach((lt0, i) => { if (t < lt0) return; const a = easeOut(seg(t, lt0, lt0 + .2)), lx = 300 + i * 360;
      boilSeed('spot' + i); paint([[lx - 30, CEIL - 20], [lx + 30, CEIL - 20], [lx + 170, G], [lx - 170, G]], { wash: '#FFF0B8', washOp: 70 * a, ink: null });
      glow(lx, G - 20, 260, '#FFE7A0', .55 * a); paint(ellPts(lx, CEIL - 20, 34, 20, 14), { wash: C.gold, ink: PAL.ink, sw: .8 }); });
    pad(t, t < THROW ? .4 : 1);
    // the lever: its rod is drawn from the pivot to Clawd's hand, so they always touch; the throw drives the arm
    const thrown = backOut(seg(t, THROW - .12, THROW + .08)), aR = lerp(1.15, -.25, thrown);
    const hand = [X + (4.9 + .55 * clamp((Math.abs(aR) - .7) / .9) + 2.2 * Math.cos(aR)) * u, G - 4.5 * u - 2.2 * Math.sin(aR) * u], P = [1440, 780];
    boilSeed('console'); paint(rrPts(1340, 760, 240, 110, 12), { wash: C.metalDk, ink: PAL.ink, sw: 1 });
    paint(ellPts(1460, 800, 22, 22, 12), { wash: t < THROW ? '#C8433A' : '#6EE07A', ink: PAL.ink, sw: .8 });
    inkLine([P, hand], 2.4, PAL.ink, 'ink', 0); paint(ellPts(...hand, 20, 20, 12), { wash: '#C8433A', ink: PAL.ink, sw: .9 });
    focus('lever', (P[0] + hand[0]) / 2, (P[1] + hand[1]) / 2, Math.abs(P[0] - hand[0]) + 40, Math.abs(P[1] - hand[1]) + 40);
    const beatWave = pulse(t, 6) * (t > LIGHTS[0] ? 1 : 0);
    const mood = emotions(t, [[TOUCH - .3, 'starstruck', { lookX: .6 }], [9.3, 'cool', { lookX: .8 }], [THROW + .1, 'proud', { lookX: -.3 }]]);
    clawd(X, G, u, { ...mood, aR, aL: t > LIGHTS[0] ? .3 + .9 * beatWave : .2, dy: (mood.dy || 0) - .25 * beatWave });
    camEnd();
    if (t > THROW && t < THROW + .15) flash(.4 * (1 - seg(t, THROW, THROW + .15)), '#FFF3C4');
    if (lt < .28) whipPan(1 - easeOut(lt / .28), -1, C.room);                                  // transition in: the whip lands on the switch
    // transition out: the lights go out in D, one by one (lights: the show ends)
  }
  // ---------- D ----------
  function shotD(t, lt, dur) {
    const u = lerp(56, 18, backOut(seg(t, SHRINK0, SHRINK1))), pin = ease(seg(t, 15.5, 17.4));
    camBegin(X + 60 * pin, lerp(560, 640, pin), lerp(.95, 1.25, pin));                     // push in, but keep the last star in frame
    room(t, 1, .3);
    LIGHTS.forEach((_, i) => { const off = OUTS[i], a = 1 - seg(t, off, off + .15), lx = 300 + i * 360; if (a <= 0) return;
      boilSeed('spot' + i); paint([[lx - 30, CEIL - 20], [lx + 30, CEIL - 20], [lx + 170, G], [lx - 170, G]], { wash: '#FFF0B8', washOp: 70 * a, ink: null });
      glow(lx, G - 20, 260, '#FFE7A0', .55 * a); });
    pad(t, lerp(1, .15, seg(t, OUTS[0], OUTS[4] + .3)));
    const mood = emotions(t, [[THROW + .1, 'proud', { lookX: -.3 }], [OUTS[1], 'sad', { lookY: -.3 }], [SHRINK1 + .1, 'hopeful', { lookX: .6, lookY: -1 }]]);
    clawd(X, G + (t > SHRINK1 ? 2 * u : 0), u, { ...mood, noLegs: t > SHRINK1, noShadow: t > SHRINK1 });
    focusClawd('clawd', X, G, u, { sit: t > SHRINK1 }); if (t > 16.2) focus('lastStar', X + 220, CEIL - 50, 70, 70, { min: 40 });
    boilSeed('lastStar'); const ls = seg(t, 16.2, 16.6); paint(starPts(X + 220, CEIL - 50, 14 + 10 * backOut(ls), .38, 4), { wash: C.gold, washOp: 255 * ls, ink: null }); glow(X + 220, CEIL - 50, 110, C.gold, .6 * ls);
    const at = toScreen(X, G - 4 * 18);
    camEnd();
    if (lt > dur - .6) iris(...at, lerp(1300, 0, easeIn(seg(lt, dur - .6, dur - .05))));     // transition out: iris on small Clawd (rhymes with the opening)
    if (lt < .2) flash(.25 * (1 - lt / .2), '#FFF3C4');                                       // transition in: the last bright beat before the lights start going out
  }
  shots([[0, shotA], [4.7, shotB], [9.3, shotC], [13.7, shotD]]);
})();
