// keys: RSI round 1 case 3, Chinese text script. Shots, reads, props, framing: ../STORYBOARD.md.
//   A 0–3.4 the hook is empty · B 3.4–7.4 the frantic search (the cat is on the sill behind) · C 7.4–10.8 the cat brings the key
//   D 10.8–14 hug, door, sunlight
(() => {
  const C = { wall: '#F2E2C4', wallDk: '#E2CBA4', wood: '#A8744F', woodDk: '#7A5236', sofa: '#4F8A8B', sofaDk: '#3A6A6B', door: '#3E5A7A', rug: '#D98A8A',
              cat: '#8C8C9A', catDk: '#5E5E6E', key: '#E8B84A', sky: '#BFE3F2', sun: '#FFD27A' };
  const BT = n => OFF + n * BEAT, G = 900, HOOK = [640, 520], SILL = [2850, 600], U = 30;
  const EMPTY = 1.6, DRAWER = 3.75, CUSHION = 5.0, CABINET = 6.2, WHIRL = 7.4, JUMP0 = 8.4, JUMP1 = 9.3, DROP = 9.6, HUG = 11.0, OPEN = 12.1;

  // ---------- characters and props ----------
  function cat(x, y, s, o = {}) {                                     // a small grey cat; o.pose: 'sit' | 'jump' | 'held'; o.key: carrying it
    boilSeed(o.key0 || 'cat'); push(); translate(x, y); scale(s * (o.flip ? -1 : 1), s);
    const tail = .4 * Math.sin((o.t || 0) * 4);
    paint(ribbon([[-40, -20], [-70, -50 + 10 * tail], [-60, -90], [-40, -100 + 15 * tail]], 14, 8), { wash: C.cat, ink: PAL.ink, sw: .8 });
    if (o.pose === 'jump') paint(ellPts(0, -30, 62, 26, 20), { wash: C.cat, ink: PAL.ink, sw: .9 });
    else paint(ellPts(0, -36, 44, 38, 20), { wash: C.cat, ink: PAL.ink, sw: .9 });
    const hx = o.pose === 'jump' ? 52 : 26, hy = o.pose === 'jump' ? -44 : -82;
    paint(ellPts(hx, hy, 28, 24, 18), { wash: C.cat, ink: PAL.ink, sw: .9 });
    for (const sx of [-1, 1]) paint([[hx + sx * 22, hy - 14], [hx + sx * 12, hy - 40], [hx + sx * 4, hy - 18]], { wash: C.cat, ink: PAL.ink, sw: .8 });
    for (const sx of [-1, 1]) paint(ellPts(hx + sx * 10, hy - 2, 3.5, o.happy ? 2 : 5, 8), { wash: PAL.ink, ink: null });
    if (o.key) key(hx + 26, hy + 14, .9, .3);
    pop();
  }
  function key(x, y, s = 1, rot = 0) {
    boilSeed('key'); push(); translate(x, y); rotate(rot); scale(s);
    paint(ellPts(-18, 0, 12, 12, 14), { wash: C.key, ink: PAL.ink, sw: .7 }); paint(ellPts(-18, 0, 5, 5, 10), { wash: C.wall, ink: null });
    paint(rectPts(-6, -3.5, 34, 7), { wash: C.key, ink: PAL.ink, sw: .6 }); paint(rectPts(20, 3, 5, 8), { wash: C.key, ink: PAL.ink, sw: .5 }); paint(rectPts(12, 3, 4, 6), { wash: C.key, ink: PAL.ink, sw: .5 });
    pop();
  }
  function room(t, sun = 0) {
    boilSeed('wall'); paint(rectPts(-400, -200, 4400, G + 200), { wash: mixCol(C.wall, '#FFF0D0', sun * .4), ink: null });
    boilSeed('wallTex'); paint(rectPts(0, 120, 3000, 200), { fill: C.wallDk, fillOp: 50, bleed: .1, tex: .5, ink: null });
    boilSeed('floor'); paint(rectPts(-400, G, 4400, 400), { wash: C.wood, ink: null }); inkLine([[-400, G], [1200, G]], 1, PAL.ink, 'ink', 0); inkLine([[1200, G], [4000, G]], 1, PAL.ink, 'ink', 0);
    boilSeed('rug'); paint(ellPts(1800, G + 60, 520, 50, 24), { wash: C.rug, ink: PAL.ink, sw: .7 });
    // the window and sill (right)
    boilSeed('window'); paint(rectPts(2700, 260, 320, 340), { wash: C.sky, ink: PAL.ink, sw: 1.1 }); inkLine([[2860, 260], [2860, 600]], 1, PAL.ink, 'ink', 0);
    paint(rectPts(2680, SILL[1], 360, 26), { wash: C.wood, ink: PAL.ink, sw: .9 });
  }
  function door(t, open) {                                           // hinged on the left; open 0..1 shows the bright outside
    boilSeed('doorway'); paint(rectPts(300, 380, 260, 520), { wash: mixCol('#FFF6DA', C.sun, .3), ink: null });
    if (open > 0) glow(430, 640, 300 + 500 * open, '#FFE7A0', open);
    const w = 260 * (1 - .85 * open); boilSeed('door'); paint(rectPts(300, 380, w, 520), { wash: C.door, ink: PAL.ink, sw: 1 });
    paint(ellPts(300 + w - 30, 650, 9, 9, 10), { wash: C.key, ink: PAL.ink, sw: .6 });
    paint(rectPts(285, 365, 290, 20), { wash: C.woodDk, ink: PAL.ink, sw: .9 });
    boilSeed('hook'); paint(rrPts(HOOK[0] - 40, HOOK[1] - 12, 80, 24, 6), { wash: C.woodDk, ink: PAL.ink, sw: .8 }); inkLine([[HOOK[0], HOOK[1] + 8], [HOOK[0], HOOK[1] + 30], [HOOK[0] + 10, HOOK[1] + 34]], 1.2, PAL.ink, 'ink', .5);
  }
  function furniture(t) {
    const dOpen = ease(seg(t, DRAWER - .2, DRAWER + .15)), cush = Math.sin(Math.PI * seg(t, CUSHION - .15, CUSHION + .7)), cab = ease(seg(t, CABINET - .15, CABINET + .1));
    boilSeed('cabinet'); paint(rectPts(1080, 600, 340, 300), { wash: C.wood, ink: PAL.ink, sw: 1 });
    for (let r = 0; r < 3; r++) paint(rectPts(1100, 620 + r * 92 + (r === 1 ? 0 : 0), 300, 80), { wash: C.woodDk, ink: PAL.ink, sw: .8 });
    paint(rectPts(1100 - 120 * dOpen, 712, 300, 80), { wash: '#C08A5E', ink: PAL.ink, sw: .9 });                    // the drawer slides out
    for (let i = 0; i < 4; i++) { const k = seg(t, DRAWER + i * .08, DRAWER + .6 + i * .08); if (k > 0 && k < 1) { const p = arcPt([1180, 720], [880 + i * 70, G], 180, k); boilSeed('thing' + i); paint(i % 2 ? rectPts(p[0] - 14, p[1] - 10, 28, 20) : ellPts(p[0], p[1], 14, 10, 10), { wash: ['#E27A92', '#8EC3E6', '#F2C14E', '#6E9F58'][i], ink: PAL.ink, sw: .6 }); } else if (k >= 1) { boilSeed('thing' + i); paint(ellPts(880 + i * 70, G - 6, 14, 6, 10), { wash: ['#E27A92', '#8EC3E6', '#F2C14E', '#6E9F58'][i], ink: PAL.ink, sw: .6 }); } }
    boilSeed('sofa'); paint(rrPts(1560, 640, 560, 200, 40), { wash: C.sofa, fill: C.sofaDk, fillOp: 40, tex: .4, ink: PAL.ink, sw: 1 });
    paint(rrPts(1580, 760, 520, 120, 30), { wash: C.sofaDk, ink: PAL.ink, sw: 1 });
    push(); translate(1840, 740 - 120 * cush); rotate(-.5 * cush); paint(rrPts(-120, -30, 240, 60, 24), { wash: '#7FB3B4', ink: PAL.ink, sw: .9 }); pop();   // the cushion flips up
    boilSeed('shoes'); paint(rectPts(2280, 700, 280, 200), { wash: C.wood, ink: PAL.ink, sw: 1 });
    push(); translate(2280, 700); paint(rectPts(0, 0, 140 * (1 - .9 * cab), 200), { wash: C.woodDk, ink: PAL.ink, sw: .8 }); pop();
    return { drawer: [1100 - 120 * dOpen + 150, 752], cushion: [1840, 740 - 120 * cush], cabinet: [2420, 800] };
  }
  const mood = t => emotions(t, [[0, 'hopeful', { lookX: -.6 }], [EMPTY + .1, 'surprised', { emote: '?', lookX: -.6, lookY: -.6 }], [DRAWER - .4, 'nervous'],
    [CABINET, 'scared'], [WHIRL + .25, 'surprised', { lookX: .8, lookY: -.4 }], [DROP + .3, 'relieved', { lookX: .3, lookY: .6 }], [HUG, 'love']]);

  // ---------- A ----------
  function shotA(t, lt, dur) {
    camBegin(lerp(760, 700, ease(seg(lt, 0, dur))), 620, lerp(1.1, 1.22, ease(seg(lt, 0, dur))));
    room(t); door(t, 0); furniture(t);
    const walk = stroll(t, .2, EMPTY - .3, 1000, 780, U), reach = seg(t, EMPTY - .5, EMPTY - .1) - seg(t, EMPTY + .4, EMPTY + .8);
    const o = { ...mood(t), ...walk, view: t < EMPTY - .3 ? 'side' : 'q', flip: true, dy: mood(t).dy + walk.dy, aR: lerp(.2, 1.2, ease(reach)) };
    clawd(walk.x, G, U, o); focusClawd('clawd', walk.x, G, U);
    focus('hook', HOOK[0], HOOK[1] + 10, 90, 60, { min: 70 });
    camEnd();
    if (lt < .45) iris(...toScreenAt(760, 620, 1.1, HOOK[0], HOOK[1]), lerp(0, 1500, easeIn(lt / .45)));      // transition in: iris open on the hook
    if (lt > dur - .2) whipPan(easeIn(seg(lt, dur - .2, dur)), -1, C.wallDk);                              // transition out: whip pan into the room
  }
  const toScreenAt = (cx, cy, z, x, y) => [W / 2 + (x - cx) * z, H / 2 + (y - cy) * z];
  // ---------- B ----------
  const searchX = t => kf(t, [[3.4, 860], [DRAWER - .3, 930], [CUSHION - .4, 930], [CUSHION - .15, 1460], [CABINET - .45, 1460], [CABINET - .2, 2120], [7.4, 2120]], easeOut);
  function shotB(t, lt, dur) {
    const x = searchX(t);
    camBegin(x + 160 - 600 * (1 - easeOut(seg(lt, 0, .28))), 640, 1.0);
    room(t); door(t, 0); const F = furniture(t);
    cat(SILL[0], SILL[1], .7, { t, key: true, pose: 'sit', flip: true }); focus('cat', SILL[0], SILL[1] - 40, 80, 80, { min: 40, offscreenOk: true }); focus('key', SILL[0] - 20, SILL[1] - 50, 30, 20, { held: true, min: 20, offscreenOk: true });   // planted
    const hop = ring(t, [DRAWER - .3, CUSHION - .15, CABINET - .2], 6, 14), o = { ...mood(t), view: 'q', flip: false, dy: mood(t).dy - .4 * Math.abs(hop), aL: .8, aR: .8 + .3 * Math.sin(t * 9), ...(t > WHIRL - .1 ? turn(t, WHIRL - .1, WHIRL + .2, .1, .25) : {}) };   // the whirl starts here: C picks it up
    clawd(x, G, U, o); focusClawd('clawd', x, G, U);
    focus('drawer', ...F.drawer, 300, 90, { min: 120 }); focus('cushion', ...F.cushion, 240, 60, { min: 120 }); focus('cabinet', ...F.cabinet, 280, 200, { min: 120, words: ['shoe cabinet'] });
    camEnd();
    if (lt < .28) whipPan(1 - easeOut(lt / .28), -1, C.wallDk);                                            // transition in: whip lands
    // transition out: cut on action — Clawd whirls round at the cat's sound; C picks up the turn closer
  }
  // ---------- C ----------
  function shotC(t, lt, dur) {
    camBegin(2480, 690, 1.5);
    room(t); furniture(t);
    const k = seg(t, JUMP0, JUMP1), [cx, cy] = t < JUMP0 ? SILL : t < JUMP1 ? arcPt(SILL, [2380, G], 160, k) : [2380, G];
    const keyOnFloor = t >= DROP, o = { ...mood(t), ...turn(t, WHIRL - .1, WHIRL + .2, .1, .25), dy: (mood(t).dy || 0) };
    clawd(2120, G, U, o); focusClawd('clawd', 2120, G, U);
    cat(cx, cy, .7, { t, key: !keyOnFloor, pose: t >= JUMP0 && t < JUMP1 ? 'jump' : 'sit', flip: true, happy: t > DROP }); focus('cat', cx, cy - 40, 100, 90, { min: 120 });
    if (keyOnFloor) { key(2285, G - 6, 1.2, -.1 + .1 * spring(t, DROP, 5, 20)); focus('key', 2285, G - 6, 60, 30, { held: true, min: 50 }); }
    else focus('key', cx - 30, cy - 50, 50, 26, { held: true, min: 30 });
    camEnd();
    // transition out: gold brush wipe into the morning outside
    if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6, ['#E8AA38', '#F2C59B']);
  }
  // ---------- D ----------
  function shotD(t, lt, dur) {
    const open = ease(seg(t, OPEN, OPEN + .7)), pb = ease(seg(t, OPEN, 13.4));
    camBegin(lerp(600, 540, pb), lerp(680, 660, pb), lerp(1.35, 1.2, pb));
    room(t, open); door(t, open); furniture(t);
    const o = { ...mood(t), view: 'front', aL: .6, aR: lerp(.2, .9, seg(t, OPEN - .5, OPEN)) };
    clawd(720, G, U, o); focusClawd('clawd', 720, G, U);
    const kh = clawdHand(720, G, U, o, 'R'); key(kh[0] + 10, kh[1] + 10, 1, .6); focus('key', kh[0] + 10, kh[1] + 10, 50, 30, { held: true, min: 30 });
    cat(720 - 20, G - 3.2 * U, .9, { t, pose: 'sit', happy: true }); focus('cat', 700, G - 3.2 * U - 50, 120, 115, { min: 120, front: true });   // in Clawd's arms
    focus('door', 430, 640, 260, 520, { min: 200, words: ['door'] });
    const at = toScreen(700, G - 4 * U);
    camEnd();
    if (open > .05) shade('rays', { t, k: .7 * open, at: toScreenAt(lerp(600, 540, pb), lerp(680, 660, pb), lerp(1.35, 1.2, pb), 430, 640), r: 900, c1: '#FFE3A0', seed: 3 });
    if (lt < .3) brushWipe(.5 + lt / .6, ['#E8AA38', '#F2C59B']);                                         // transition in: the wipe drags off
    if (lt > dur - .6) iris(...at, lerp(1300, 0, easeIn(seg(lt, dur - .6, dur - .05))));                 // transition out: iris on Clawd and the cat
  }
  shots([[0, shotA], [3.4, shotB], [7.4, shotC], [10.8, shotD]]);
  sound([...[.4, .7, 1.0].map(at => ({ at, kind: 'thud', gain: .2 })), { at: EMPTY + .1, kind: 'pop', freq: 640, gain: .4 },
    { at: 3.2, kind: 'whoosh', dur: .4, gain: .35 }, ...[0, 1, 2, 3].map(i => ({ at: DRAWER + .05 + i * .08, kind: 'click', gain: .4 })), { at: CUSHION, kind: 'whoosh', dur: .4, gain: .35, up: true },
    { at: CABINET, kind: 'thud', gain: .5 }, { at: WHIRL - .15, kind: 'tone', freq: 700, glide: 980, dur: .35, wave: 'sine', gain: .3 }, { at: DROP, kind: 'chime', note: 'E6', gain: .4 },
    { at: HUG, kind: 'pad', notes: ['C3', 'G3', 'E4'], dur: 2.8, gain: .2, attack: .5 }, { at: OPEN, kind: 'tone', freq: 160, glide: 120, dur: .6, wave: 'triangle', gain: .25 },
    ...[0, 1, 2].map(i => ({ at: OPEN + .5 + i * .3, kind: 'chime', note: ['G6', 'B6', 'D7'][i], gain: .2 })), { at: 0, kind: 'pad', notes: ['F3', 'C4', 'A4'], dur: 10.5, gain: .12, attack: 1 }]);
})();
