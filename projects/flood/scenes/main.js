// flood: RSI round 1 case 2, image input (gpt-6-the-last-one.mp4 @121 s). Shots, reads, props, framing: ../STORYBOARD.md.
//   A 0–3.3 the river climbs, the lantern goes up · B 3.3–6.7 the gust, the shield, the raft turns · C 6.7–10 they reach the roof; dawn
(() => {
  const C = { sky: '#526c7f', night: '#0e3355', water: '#1d4c6c', waterLt: '#4E7E9C', deep: '#142b25', mist: '#879b99', bld: '#2A3A4A', roof: '#3E4E5E',
              gold: '#F2C14E', flame: '#FFB347', wood: '#8A5A3C', dawn: '#F2C59B' };
  const BT = n => OFF + n * BEAT, ROOF = 620, RX = 520, U = 26;
  const RAISE = BT(2), GUST = 3.15, SHIELD = 4.4, TURN = 5.4, BUMP = 7.2, CLIMB = 7.35, HUDDLE = 7.9, DRY = 8.4, DAWN = 8.7;
  const level = t => lerp(900, 760, ease(seg(t, .2, 1.0)) * .4 + ease(seg(t, BT(1), BT(1) + .3)) * .3 + ease(seg(t, BT(2), BT(2) + .3)) * .3) + 18 * ease(seg(t, DAWN, 10));
  const raftAt = t => t < TURN ? [lerp(1750, 1650, seg(t, 0, TURN)), 0] : t < BUMP ? [lerp(1650, 820, ease(seg(t, TURN, BUMP))), -.25 * Math.sin(Math.PI * seg(t, TURN, TURN + 1))] : [820 + 6 * spring(t, BUMP, 4, 12), 0];

  function sky(t) {
    const d = ease(seg(t, DAWN - .3, 9.6));
    boilSeed('sky'); paint(rectPts(-600, -400, 3200, 1400), { wash: mixCol(C.night, C.dawn, d * .8), ink: null });                       // flat base (cost: a 3200 px fill cost ~15 s/frame on the VM)
    boilSeed('cloud'); paint(ellPts(900, 180, 1100, 220, 24, 6), { fill: mixCol(C.sky, '#F7D9B0', d), fillOp: 80, bleed: .15, tex: .4, ink: null });
    if (d > 0) { const sy = lerp(720, 470, d); boilSeed('sun'); glow(1500, sy, 420, '#FFD27A', d); paint(ellPts(1500, sy, 60, 60, 24), { wash: '#FFE6B0', washOp: 255 * d, ink: null }); }
  }
  function town(t) {
    for (let i = 0; i < 7; i++) { const x = 900 + i * 230 + 30 * hash(i), h = 260 + 200 * hash(i + 3);
      boilSeed('b' + i); paint(rectPts(x, 900 - h, 180, h + 300), { wash: mixCol(C.bld, C.mist, .2 * hash(i)), ink: PAL.ink, sw: .6 });
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (hash(i * 17 + r * 3 + c) < .4) paint(rectPts(x + 20 + c * 52, 900 - h + 30 + r * 50, 26, 28), { wash: C.gold, washOp: 200, ink: null }); }
    boilSeed('house'); paint(rectPts(200, ROOF, 560, 600), { wash: C.bld, fill: C.roof, fillOp: 60, tex: .5, ink: PAL.ink, sw: 1 });   // Clawd's roof
    paint(rectPts(190, ROOF - 18, 580, 24), { wash: C.roof, ink: PAL.ink, sw: 1 });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) paint(rectPts(240 + c * 130, ROOF + 60 + r * 110, 60, 70), { wash: '#1A2633', ink: PAL.ink, sw: .6 });
  }
  function river(t) {
    const y0 = level(t);
    boilSeed('water'); paint(rectPts(-600, y0, 3200, 800), { wash: C.water, ink: null });
    boilSeed('waterTex'); paint(rectPts(-200, y0, 2400, 140), { fill: C.deep, fillOp: 60, bleed: .05, tex: .5, ink: null });            // texture only near the surface
    for (let k = 0; k < 5; k++) { boilSeed('wave' + k); const P = []; for (let x = -600; x <= 2600; x += 80) P.push([x, y0 + 18 + k * 34 + 9 * Math.sin(x / 90 + t * (2.2 + k * .3) + k)]);
      for (let a = 0; a < P.length - 1; a += 20) inkLine(P.slice(a, a + 21), .9, mixCol(C.waterLt, '#FFFFFF', .2), 'ink', .5); }
    focus('river', 1000, y0 + 80, 2400, 200, { min: 300 });
  }
  function rain(t, k) {
    if (k <= 0) return; boilSeed('rain');
    for (let i = 0; i < Math.round(70 * k); i++) { const x = ((hash(i) * 2300 + t * 300) % 2300) - 200, y = ((hash(i + 9) * 1300 + t * (1500 + 400 * hash(i + 3))) % 1300) - 150;
      inkLine([[x, y], [x + 8, y + 40]], .5, '#B8C8D8', 'inkfine', 0); }
  }
  function lantern(x, y, swing, flicker) {                         // hangs from (x, y) = the hand
    boilSeed('lantern'); push(); translate(x, y); rotate(swing);
    inkLine([[0, 0], [0, 26]], 1, PAL.ink, 'ink', 0);
    paint(rrPts(-20, 26, 40, 56, 8), { wash: '#3A3A30', ink: PAL.ink, sw: .9 });
    paint(rrPts(-14, 32, 28, 42, 6), { wash: C.flame, washOp: 140 + 115 * flicker, ink: null });
    paint(ellPts(0, 54 - 4 * flicker, 6 + 3 * flicker, 11 + 6 * flicker, 12), { wash: '#FFE7A0', ink: null });
    pop();
    const gx = x + Math.sin(-swing) * -54, gy = y + Math.cos(swing) * 54;
    glow(gx, gy, 140 + 90 * flicker, '#FFC766', .4 + .6 * flicker);
    return [gx, gy];
  }
  function raft(t, k = 1) {
    const [x, rot] = raftAt(t), y = level(t) + 6;
    boilSeed('raft'); push(); translate(x, y); rotate(rot); paint(rrPts(-110, -14, 220, 28, 6), { wash: C.wood, ink: PAL.ink, sw: 1 }); pop();
    const on = t < CLIMB ? 3 : t < HUDDLE ? 3 - Math.floor(seg(t, CLIMB, HUDDLE) * 3.01) : 0;
    for (let i = 0; i < on; i++) clawd(x - 60 + i * 60, y - 12, 13, { ...feel(t < HUDDLE ? 'scared' : 'happy', t), seed: i * 2, view: 'q', boilKey: 'small' + i, hat: ['hard', 'beanie', null][i], lite: true });   // lite: three small Clawds cost ~12 s/frame in watercolour (profiled)
    focus('raft', x, y - 40, 240, 120, { min: 120 });
    return [x, y];
  }
  function smalls(t) {                                           // climbing up and huddling around Clawd on the roof
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t0 = CLIMB + i * .17, k = seg(t, t0, t0 + .45); if (t < t0) continue;
      const [rx] = raftAt(t0), p0 = [rx - 60 + i * 60, level(t0) - 12], p1 = [RX - 120 + i * 95 + (i > 0 ? 40 : 0), ROOF - 18], [x, y] = k < 1 ? arcPt(p0, p1, 140, ease(k)) : p1;
      clawd(x, y, 13, { ...emotions(t, [[0, 'scared'], [HUDDLE + .1 * i, 'relieved'], [DAWN + .2, 'happy']]), seed: i * 2, view: k < 1 ? 'q' : 'front', boilKey: 'small' + i, hat: ['hard', 'beanie', null][i], sit: k >= 1, lite: true });
      out.push([x, y]);
    }
    return out;
  }
  const mood = t => emotions(t, [[0, 'nervous', { lookX: .8 }], [RAISE - .2, 'determined', { lookX: 1 }], [HUDDLE + .3, 'relieved'], [DAWN + .4, 'happy']]);

  // ---------- A ----------
  function shotA(t, lt, dur) {
    camBegin(900 + 20 * lt, 640, .9 + .02 * lt);
    sky(t); town(t); river(t);
    const aR = lerp(-.4, 1.25, backOut(seg(t, RAISE - .4, RAISE + .1))), o = { ...mood(t), view: 'q', aR };   // the lead arm: toward the water
    clawd(RX, ROOF - 6, U, o); focusClawd('clawd', RX, ROOF - 6, U);
    const hand = clawdHand(RX, ROOF - 6, U, o, 'lead'), swing = .08 * Math.sin(t * 3) + (lt > dur - .25 ? -.5 * easeIn(seg(lt, dur - .25, dur)) : 0);
    const [gx, gy] = lantern(...hand, swing, .8 + .2 * Math.sin(t * 13)); focus('lantern', gx, gy, 60, 90, { held: true, min: 50 });
    const y0 = level(t), reach = ease(seg(t, RAISE, RAISE + .9));                                   // the gold path on the water
    for (let i = 0; i < 8; i++) { const u = i / 7, px = lerp(780, 1700, u) * reach + 780 * (1 - reach); glow(px, y0 + 24, 90 + 50 * (1 - u), '#FFC766', reach * (1 - .4 * u));
      boilSeed('glint' + i); inkLine([[px - 40, y0 + 22 + 6 * Math.sin(t * 3 + i)], [px + 40, y0 + 26 + 6 * Math.sin(t * 3 + i)]], 1.6, C.gold, 'ink', .4); }
    if (reach > .2) focus('path', 1240, y0 + 24, 920 * reach, 80, { min: 200, words: ['gold path', 'path of light'] });
    raft(t);
    camEnd();
    rain(t, 1);
    if (lt < .3) flash(1 - lt / .3, '#DDE8FF');                                                  // transition in: lightning flash
    // transition out: cut on action — the gust swings the lantern; B catches the swing closer
  }
  // ---------- B ----------
  function shotB(t, lt, dur) {
    const back = ease(seg(t, TURN - .2, TURN + .6));
    camBegin(lerp(RX + 40, 980, back), lerp(540, 620, back), lerp(1.6, 1.12, back));
    sky(t); town(t); river(t);
    const gust = Math.exp(-Math.max(0, t - GUST) * 1.2) * (t > GUST ? 1 : 0), shield = ease(seg(t, SHIELD - .3, SHIELD + .3));
    const o = { ...mood(t), view: shield > .5 ? 'side' : 'q', aR: 1.25, aL: lerp(1.25, .25, shield), rot: .12 * shield, sq: (mood(t).sq || 0) + .08 * shield, squint: .5 * gust };
    clawd(RX, ROOF - 6, U, o); focusClawd('clawd', RX, ROOF - 6, U);
    const hand = clawdHand(RX, ROOF - 6, U, o, 'lead'), swing = -.5 * gust * Math.cos((t - GUST) * 6) * (1 - shield) + .05 * Math.sin(t * 3);
    const flick = clamp(.35 + .65 * shield + .2 * Math.sin(t * 17) * (1 - shield)), [gx, gy] = lantern(...hand, swing, flick);
    focus('lantern', gx, gy, 60, 90, { held: true, min: 50 });
    raft(t);
    camEnd();
    rain(t, 1);
    if (t > GUST && t < GUST + 1.2) { boilSeed('gust'); for (let i = 0; i < 6; i++) { const k = seg(t, GUST + i * .08, GUST + .7 + i * .08); if (k > 0 && k < 1) inkLine([[W * (1.1 - k * 1.3), 300 + i * 90], [W * (1.25 - k * 1.3), 285 + i * 90], [W * (1.4 - k * 1.3), 300 + i * 90]], 2.4, '#EEF4FF', 'ink', .5); } }
    if (lt > dur - .2) flash(easeIn(seg(lt, dur - .2, dur)), '#DDE8FF');                         // transition out: lightning flash
  }
  // ---------- C ----------
  function shotC(t, lt, dur) {
    const pb = ease(seg(t, DAWN, 10));
    camBegin(lerp(760, 820, pb), lerp(560, 600, pb), lerp(1.25, 1.0, pb));
    sky(t); town(t); river(t);
    const o = { ...mood(t), view: 'front', aL: .2, aR: .6 }; clawd(RX, ROOF - 6, U, o); focusClawd('clawd', RX, ROOF - 6, U);
    const hand = clawdHand(RX, ROOF - 6, U, o, 'R'), [gx, gy] = lantern(...hand, .04 * Math.sin(t * 2), .9);
    focus('lantern', gx, gy, 60, 90, { held: true, min: 50 });
    raft(t); const S = smalls(t);
    if (t > HUDDLE) focus('huddle', RX + 20, ROOF - 70, 420, 160, { min: 200 });
    camEnd();
    rain(t, 1 - seg(t, DRY - .3, DRY + .3));
    if (lt < .3) flash(1 - lt / .3, '#DDE8FF');                                                  // transition in: the last lightning
    const at = [W / 2, H / 2 - 40];
    if (lt > dur - .6) iris(...at, lerp(1300, 0, easeIn(seg(lt, dur - .6, dur - .05))));        // transition out: iris on the huddle
  }
  shots([[0, shotA], [3.3, shotB], [6.7, shotC]]);
  sound([{ at: 0, kind: 'rain', dur: DRY + .3, gain: .45, attack: .2, release: .8 }, { at: 0, kind: 'boom', dur: 2.5, gain: .7 }, { at: 6.7, kind: 'boom', dur: 2.0, gain: .5 },
    { at: GUST, kind: 'whoosh', dur: .9, gain: .55, up: false }, { at: BUMP, kind: 'splash', gain: .6, size: .5 }, ...[0, 1, 2].map(i => ({ at: CLIMB + i * .17 + .45, kind: 'pop', freq: 520 + 80 * i, gain: .25 })),
    { at: 0, kind: 'pad', notes: ['D3', 'A3', 'F4'], dur: DAWN - .2, gain: .16, attack: 1 }, { at: DAWN, kind: 'pad', notes: ['D3', 'A3', 'F#4', 'A4'], dur: 1.3, gain: .2, attack: .5 },
    { at: DAWN + .3, kind: 'chime', note: 'A6', gain: .3 }]);
})();
