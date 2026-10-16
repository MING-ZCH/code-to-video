// umbrella: "The umbrella" (14 s). See ../STORYBOARD.md for the shots and their reads.
//   A 0–3.2   rain; bored Clawd on the curb; a paper boat drifts in; Clawd notices, gasps, jumps up      (iris in)
//   B 3.2–7   whip pan; Clawd runs alongside holding a leaf over the boat; the drain appears; scared   (whip pan in)
//   C 7–10    the boat tips into the drain; Clawd dives, catches it, lands in a puddle: soaked, proud (cut on action)
//   D 10–14   gold brush wipe: rain gone, sun out; a butterfly lands on the boat; Clawd in love      (brush wipe in, iris out)
(() => {
  const C = { slate: '#5B6C8A', asphalt: '#3E4660', curb: '#9AA3B5', curbDk: '#77809A', water: '#7F9CC0', leaf: '#6E9F58', leafDk: '#4F7A3E',
              paper: '#F3EBDC', paperDk: '#D9CDB6', grate: '#2E3348', sun: '#FFD27A', warm: '#F2C59B', warmRoad: '#8C7A86' };
  const WALK = 640, CURB = 720, WATER = 742, ROAD = 790;          // sidewalk top, curb bottom, waterline, road top (world y)
  const GRATE = 2750;                                              // drain grate world x
  const BS = 1.3;                                                  // boat scale in the gutter (the eye has to find it)
  // story constants shared by picture and sound
  const NOTICE = 1.6, GASP = 2.3, UP = 2.75, CUT_B = 3.2, CUT_C = 7.0, TIP = 7.3, DIVE = 7.8, CATCH = 8.25, LAND = 8.55, CUT_D = 10.0, BFLY = 12.3, END = 14;

  // ---------- the boat: world position as a pure function of video time ----------
  function boatAt(t) {
    if (t < CUT_B) return { x: lerp(-140, 900, seg(t, .1, CUT_B)), y: WATER, rot: .05 * wob(t, .7) };   // (c2v reads, RSI-1: entering at .5 left its read only 0.25 s)
    if (t < TIP) return { x: lerp(900, 2640, ease(seg(t, CUT_B, TIP) * .5 + .5) * 2 - 1), y: WATER, rot: .05 * wob(t, .7) };
    const k = seg(t, TIP, CATCH);                                   // tips over the grate edge and slides in
    return { x: lerp(2640, GRATE - 10, easeOut(k)), y: WATER + 26 * easeIn(k), rot: -1.0 * easeIn(k) };
  }
  const focusBoat = b => focus('boat', b.x, b.y - 44 * BS, 124 * BS, 104 * BS);   // what the viewer must find (c2v reads)
  function boat(x, y, s, rot = 0, key = 'boat') {
    boilSeed(key); push(); translate(x, y); rotate(rot); scale(s);
    paint([[-62, -22], [62, -22], [44, 8], [-44, 8]], { wash: C.paper, fill: C.paperDk, fillOp: 50, tex: .4, ink: PAL.ink, sw: .9 });
    paint([[-4, -24], [-4, -96], [40, -26]], { wash: C.paper, ink: PAL.ink, sw: .9 });
    paint([[-6, -24], [-6, -82], [-38, -26]], { wash: C.paperDk, ink: PAL.ink, sw: .8 });
    inkLine([[-44, -10], [44, -10]], .5, C.paperDk, 'inkfine', 0);
    pop();
  }
  // ---------- set ----------
  function street(t, x0, x1, warm = 0) {
    const sky = mixCol(C.slate, C.warm, warm), road = mixCol(C.asphalt, C.warmRoad, warm);
    boilSeed('sky'); paint(rectPts(x0, -400, x1 - x0, WALK - 160 + 400), { wash: sky, ink: null });
    boilSeed('wall'); paint(rectPts(x0, 280, x1 - x0, WALK - 280), { wash: mixCol(sky, PAL.ink, .18), fill: mixCol(sky, PAL.night, .3), fillOp: 60, bleed: .05, tex: .5, ink: null });
    for (let i = Math.floor(x0 / 420); i < x1 / 420; i++) {          // windows on the wall, stable per index
      boilSeed('win' + i); const wx = i * 420 + 90 + 60 * hash(i);
      paint(rrPts(wx, 330 + 40 * hash(i + 7), 150, 120, 10), { wash: mixCol(mixCol(sky, PAL.ink, .35), C.sun, warm * .5 + .15 * hash(i + 3)), ink: PAL.ink, sw: .7 });
    }
    boilSeed('walk'); paint(rectPts(x0, WALK - 30, x1 - x0, 30), { wash: mixCol(C.curb, C.warm, warm * .4), ink: null });
    boilSeed('curb'); paint(rectPts(x0, WALK, x1 - x0, CURB - WALK), { wash: mixCol(C.curbDk, C.warm, warm * .3), ink: null });
    for (let x = x0; x < x1; x += 1600) inkLine([[x, WALK], [Math.min(x1, x + 1600), WALK]], .9, PAL.ink, 'ink', 0);   // canvas-sized edges
    boilSeed('road'); paint(rectPts(x0, CURB, x1 - x0, 700), { wash: road, ink: null });
    boilSeed('water'); paint(rectPts(x0, CURB, x1 - x0, ROAD - CURB), { wash: mixCol(C.water, C.sun, warm * .45), fill: mixCol(C.water, PAL.cream, .3), fillOp: 70, bleed: .05, tex: .5, ink: null });
    for (let x = x0; x < x1; x += 1600) inkLine([[x, ROAD], [Math.min(x1, x + 1600), ROAD]], .6, mixCol(PAL.ink, road, .4), 'inkfine', 0);
    if (GRATE > x0 - 200 && GRATE < x1 + 200) {
      boilSeed('grate'); paint(rrPts(GRATE - 90, CURB + 18, 180, ROAD - CURB - 10, 8), { wash: C.grate, ink: PAL.ink, sw: .9 });
      for (let k = 0; k < 6; k++) inkLine([[GRATE - 70 + k * 28, CURB + 26], [GRATE - 70 + k * 28, ROAD - 2]], .7, mixCol(C.grate, C.curb, .5), 'inkfine', 0);
    }
  }
  // rain: screen space, a pure function of t; streaks stop on the leaf canopy (span [ax, bx] at screen y cy)
  function rain(t, k = 1, canopy = null) {
    if (k <= 0) return;
    boilSeed('rain');
    const n = Math.round(90 * k);
    for (let i = 0; i < n; i++) {
      const sp = 1500 + 500 * hash(i + 40), x = ((hash(i) * 2300 + t * 260) % 2300) - 200, y = ((hash(i + 9) * 1300 + t * sp) % 1300) - 150, L = 34 + 18 * hash(i + 3);
      let y1 = y + L; const xs = x + L * .16;
      if (canopy && xs > canopy[0] && xs < canopy[1]) {          // the leaf shelters everything below its top: no rain under it
        if (y >= canopy[2]) continue;
        if (y1 > canopy[2]) { y1 = canopy[2]; paint(ellPts(xs, y1 - 2, 9, 3, 8), { wash: PAL.cream, washOp: 200, ink: null }); }
      }
      if (y1 > y + 4) inkLine([[x, y], [x + (y1 - y) * .16, y1]], .5, mixCol(PAL.cream, C.slate, .25), 'inkfine', 0);
    }
  }
  function ripples(t, x0, x1) {                                   // rings on the gutter water where drops land
    for (let i = 0; i < 16; i++) {
      const per = .7 + .5 * hash(i + 60), ph = frac(t / per + hash(i + 61)), x = x0 + hash(i + 62 + Math.floor(t / per + hash(i + 61)) * 13) * (x1 - x0);
      boilSeed('rip' + i); paint(ellPts(x, WATER + 14, 6 + 30 * ph, 2 + 6 * ph, 14), { ink: mixCol(PAL.cream, C.water, ph), sw: .5 * (1 - ph) + .1 });
    }
  }
  // whip-pan smear: horizontal paint strokes across the frame, k 0..1 strength (screen space)
  function whip(k, dir = 1, col = C.slate) {
    if (k <= .02) return;
    for (let i = 0; i < 14; i++) {
      boilSeed('whip' + i); const y = hash(i + 5) * H, w = W * (.4 + .6 * hash(i + 6)), x = hash(i + 7) * W - w / 2;
      paint(ribbon([[x, y], [x + w * .5, y + 6 * dir], [x + w, y]], 4, 30 + 50 * hash(i)), { wash: mixCol(col, PAL.cream, hash(i + 8) * .4), washOp: 255 * k, ink: null });
    }
  }
  // the leaf: one design everywhere (B held over the boat, C held then dropped, falling). A dome over a rib, scalloped rim.
  function leafDome(cx, cy, hw, rot = 0, key = 'leaf') {
    boilSeed(key); push(); translate(cx, cy); rotate(rot);
    const P = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; P.push([Math.cos(a) * hw, Math.sin(a) * hw * .5]); }
    for (let i = 0; i <= 8; i++) P.push([hw - i / 8 * 2 * hw, 6 + 10 * hw / 150 * Math.abs(Math.sin(i / 8 * Math.PI * 4))]);
    paint(P, { wash: C.leaf, fill: C.leafDk, fillOp: 70, tex: .5, ink: PAL.ink, sw: clamp(hw / 150, .5, 1) });
    inkLine([[0, 8], [0, -hw * .5]], .7 * clamp(hw / 150, .5, 1), C.leafDk, 'inkfine', 0);
    for (const sd of [-1, 1]) for (const f of [.35, .7]) inkLine([[0, -hw * .5 * (1 - f * .6)], [sd * hw * f, -hw * .5 * Math.sqrt(1 - f * f) * .9]], .45, C.leafDk, 'inkfine', .5);
    pop();
  }
  // held from the hand: a stem from the hand to the dome's centre; returns the canopy span + top (world) for the rain
  function leafUmbrella(hx, hy, dx0, dx1, dy, key) {
    boilSeed(key + 'stem');
    const cx = hx + (dx0 + dx1) / 2, cy = hy + dy, hw = (dx1 - dx0) / 2;
    inkLine([[hx, hy], [lerp(hx, cx, .5), lerp(hy, cy, .5) - 10], [cx, cy]], 1.3, C.leafDk, 'ink', .5);
    leafDome(cx, cy, hw, 0, key);
    return [cx - hw, cx + hw, cy - hw * .5];
  }
  const toScreenAt = (cx, cy, z, x, y) => [W / 2 + (x - cx) * z, H / 2 + (y - cy) * z];
  // side-view hand position (near arm, facing right), mirrors clawd()'s arm geometry: pivot (1.6u, -4.2u), angle .7 - a
  const handAt = (x, y, u, a, dyU = 0) => { const th = .7 - a; return [x + (1.6 + 2.1 * Math.cos(th)) * u, y + dyU * u - 4.2 * u + 2.1 * Math.sin(th) * u]; };

  // ---------- A: the boat arrives ----------
  function shotA(t, lt, dur) {
    const b = boatAt(t);
    const cx = lerp(960, 1010, ease(seg(lt, 0, dur))) + 900 * easeIn(seg(lt, dur - .22, dur));   // the whip starts on the jump-up
    camBegin(cx, 600, lerp(1.15, 1.22, ease(seg(lt, .3, 2.6))));
    street(t, -400, 2400);
    ripples(t, -200, 2200);
    boat(b.x, b.y + 3 * wob(t, .9), BS, b.rot); focusBoat(b);
    const look = clamp((b.x - 560) / 400, -1, 1);
    const mood = emotions(lt, [[0, 'bored', { lookX: -.2 }], [NOTICE, 'thinking', { lookX: look, lookY: .6 }], [GASP, 'surprised', { lookX: 1, lookY: .4 }]]);
    // the leaf is planted here (lying on the sidewalk beside Clawd) so it doesn't pop in after the cut: grabbed on the jump-up
    const hop = jump(lt, UP, UP + .35, 2.2), GRAB = UP + .12;
    const [hx, hy] = handAt(600, WALK - 18, 26, .75, hop.dy), held = [hx + 115, hy - 40], gk = seg(lt, UP, GRAB + .1);
    if (lt < UP) { leafDome(760, WALK - 8, 95, .12, 'leafA'); focus('leaf', 760, WALK - 30, 190, 60, { min: 40 }); }
    else if (gk < 1) { const p = arcPt([760, WALK - 8], held, 60, easeOut(gk)); leafDome(p[0], p[1], lerp(95, 110, gk), lerp(.12, 0, gk), 'leafA'); }   // swept up into the hand
    else { const c = leafUmbrella(hx, hy, 10, 220, -40, 'leafA'); focus('leaf', (c[0] + c[1]) / 2, c[2] + 30, c[1] - c[0], 80); }
    const seated = lt < UP - .1;                                    // sitting: no legs, body bottom on the sidewalk
    clawd(600, WALK - 18 + (seated ? 2 * 26 : 0), 26, { ...mood, dy: mood.dy + hop.dy, sq: mood.sq + hop.sq, view: lt > UP ? 'side' : 'front', noLegs: seated, noShadow: seated, ...(lt >= UP ? { aL: lerp(.2, .75, easeOut(gk)) } : {}) });
    focusClawd('clawd', 600, WALK - 18 + (seated ? 52 : 0), 26, { sit: seated });
    camEnd();
    rain(t, 1);
    if (lt < .5) iris(...toScreenAt(cx, 600, 1.15, 300, WATER - 40), lerp(0, 1500, easeIn(lt / .5)));                               // transition in: iris opens on the gutter
    if (lt > dur - .22) whip(easeIn(seg(lt, dur - .22, dur)));                                   // transition out: whip pan
  }
  // ---------- B: running with the leaf ----------
  function shotB(t, lt, dur) {
    const b = boatAt(t), u = 22;
    const settle = 1 - easeOut(seg(lt, 0, .3));
    const cx = b.x - 110 + 700 * settle;
    camBegin(cx, 600, 1.22);
    street(t, cx - 1200, cx + 1200);
    ripples(t, cx - 1100, cx + 1100);
    boat(b.x, b.y + 3 * wob(t, .9), BS, b.rot); focusBoat(b);
    const run = move('run', t), x = b.x - 150;
    const mood = emotions(t, [[GASP, 'surprised'], [CUT_B + .2, 'determined', { lookX: .6, lookY: .5 }], [6.3, 'scared', { lookX: 1, lookY: .3 }]]);
    const aL = .75, [hx, hy] = handAt(x, WALK, u, aL, run.dy);     // arm raised forward, holding the stem
    const top = WATER - 96 * BS - 55;                               // canopy rim above the sail tip, centred on the boat
    boilSeed('dry'); paint(ellPts(b.x, WATER + 14, 150, 12, 20), { wash: mixCol(C.water, PAL.ink, .25), washOp: 150, ink: null });   // the dry patch under the leaf
    const can = leafUmbrella(hx, hy, b.x - 150 - hx, b.x + 150 - hx, top - hy, 'leafB');
    clawd(x, WALK, u, { ...mood, ...run, aL, view: 'side', dy: mood.dy + run.dy, rot: run.rot * .5 });
    focus('leaf', (can[0] + can[1]) / 2, can[2] + 40, can[1] - can[0], 100, { held: true }); focusClawd('clawd', x, WALK, u);
    const scr = [toScreen(can[0], can[2])[0], toScreen(can[1], can[2])[0], toScreen(0, can[2])[1]];
    camEnd();
    rain(t, 1, scr);
    if (lt < .3) whip(1 - easeOut(lt / .3));                                                      // transition in: whip pan lands
    // transition out: cut on action — the boat starts to tip at the grate and C continues it
  }
  // ---------- C: the dive ----------
  function shotC(t, lt, dur) {
    const b = boatAt(t), u = 26;
    const pin = ease(seg(t, LAND, LAND + .8)), [sx, sy] = shakeXY(t, t > LAND ? 6 * Math.exp(-(t - LAND) * 6) : 0);
    camBegin(lerp(2650, 2700, pin) + sx, lerp(650, 690, pin) + sy, lerp(1.5, 1.65, pin));   // closer than B (no jump cut); push in on the landing
    street(t, 1600, 3800);
    ripples(t, 1800, 3600);
    // Clawd: stops, crouches, dives on an arc, catches the boat at CATCH, lands sitting at LAND
    const runX = lerp(2470, 2500, ease(seg(t, CUT_C, TIP)));
    const k = seg(t, DIVE, LAND), P0 = [runX, WALK], P1 = [GRATE - 30, ROAD + 40], [px, py] = t < DIVE ? P0 : arcPt(P0, P1, 120, easeOut(k));
    const hop = t < DIVE ? jump(t, DIVE, DIVE + .01, 0) : { dy: 0, sq: t > LAND ? .22 * Math.exp(-8 * (t - LAND)) * Math.cos(20 * (t - LAND)) : -.15 };
    const mood = emotions(t, [[6.3, 'scared', { lookX: 1, lookY: .4 }], [TIP + .1, 'determined', { lookX: 1, lookY: .6 }], [LAND + .05, 'surprised', { tint: 'blue', tintK: .55 }],
                              [9.2, 'proud', { tint: 'blue', tintK: .55, emote: 'sweat' }]]);
    const held = t >= CATCH, lift = ease(seg(t, 9.2, 9.6));
    const aL = held ? lerp(.1, 1.0, lift) : t > DIVE ? .8 : .75;
    if (!held) { boat(b.x, b.y + 3 * wob(t, .9), BS, b.rot); focusBoat(b); }
    // the leaf from B: still held while Clawd stops, let go on the dive, it flutters down into the gutter (continuity)
    const LET = DIVE - .02, fk = seg(t, LET, LET + 1.6);
    const leafAt = t < LET ? null : [lerp(2620, 2460, fk) + 40 * Math.sin(fk * 7), lerp(560, WATER - 6, easeIn(fk))];
    if (leafAt) leafDome(leafAt[0], leafAt[1], lerp(150, 110, fk), .7 * Math.sin(fk * 6) * (1 - fk) - .1 + .2 * fk, 'leafC');
    if (t < LET) { const [hx, hy] = handAt(px, py, u, aL); const c = leafUmbrella(hx, hy, 20, 300, -10, 'leafC'); focus('leaf', (c[0] + c[1]) / 2, c[2] + 40, c[1] - c[0], 100, { held: true }); }
    else if (leafAt) focus('leaf', leafAt[0], leafAt[1], 220, 70, { offscreenOk: true });
    // splash on landing: droplets fly outward from the impact, behind Clawd; the ring sits on the water in front
    if (t > LAND && t < LAND + .9) { const a = seg(t, LAND, LAND + .9);
      for (let i = 0; i < 9; i++) { boilSeed('spl' + i); const ang = Math.PI * (1.05 + .9 * i / 8), d = 150 + 170 * easeOut(a);
        paint(ellPts(P1[0] + Math.cos(ang) * d, P1[1] - 30 + Math.sin(ang) * d * .7 + 300 * a * a, 10 * (1 - a) + 2, 14 * (1 - a) + 2, 10), { wash: PAL.cream, washOp: 230 * (1 - a), ink: null }); } }
    const sit = t > LAND ? 2 * u : 0;                                   // seated after the landing: body bottom on the water
    focusClawd('clawd', px, py + sit, u);
    clawd(px, py + sit, u, { ...mood, dy: mood.dy + hop.dy, sq: mood.sq + hop.sq, view: 'side', aL, rot: t > DIVE && t < LAND ? .35 * Math.sin(k * Math.PI) : 0,
      smear: t > DIVE && t < CATCH ? .5 : 0, noLegs: t > LAND,
      armL: held ? (uu, sw) => { push(); rotate(-(.7 - aL)); boat(0, 6, .8, -.08 + .1 * spring(t, CATCH, 6, 14), 'boatHeld'); pop(); } : null });
    if (t > LAND && t < LAND + .9) { const a = seg(t, LAND, LAND + .9); boilSeed('ring'); paint(ellPts(P1[0], P1[1] + 10, 90 + 180 * easeOut(a), 14 + 30 * easeOut(a), 24), { ink: PAL.cream, sw: 1.2 * (1 - a) + .2 }); }
    camEnd();
    rain(t, 1);
    if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6, ['#E8AA38', '#F2C59B']);                // transition out: gold brush wipe
  }
  // ---------- D: the sun and the butterfly ----------
  function butterfly(x, y, s, t, landed) {
    const flap = landed ? .35 + .25 * Math.abs(Math.sin(t * 3)) : .2 + .8 * Math.abs(Math.sin(t * 14));
    boilSeed('bfly'); push(); translate(x, y); scale(s);
    for (const side of [-1, 1]) {
      paint(ellPts(side * 16 * flap, -10, 18 * flap + 3, 16, 14, 0, side * .3), { wash: '#F0A04B', fill: '#E27A92', fillOp: 80, tex: .4, ink: PAL.ink, sw: .6 });
      paint(ellPts(side * 12 * flap, 10, 12 * flap + 2, 10, 12), { wash: '#E27A92', ink: PAL.ink, sw: .5 });
    }
    paint(ellPts(0, 0, 4, 18, 10), { wash: PAL.ink, ink: null });
    inkLine([[0, -16], [-8, -30]], .4); inkLine([[0, -16], [8, -30]], .4);
    pop();
  }
  function shotD(t, lt, dur) {
    const pk = ease(seg(t, 11.6, 13.0)), u = 34, X = 900, Y = ROAD + 70;           // push in for the payoff
    camBegin(lerp(980 + 30 * Math.sin(lt * .4), X + 90, pk), lerp(560, Y - 150, pk), lerp(1.05, 1.5, pk));
    street(t + 100, -300, 2300, ease(seg(lt, 0, 1.0)));
    boilSeed('sunglow'); glow(1500, 180, 420, C.sun, .55 * ease(seg(lt, .2, 1.2)));
    const mood = emotions(t, [[9.2, 'proud', { tint: 'blue', tintK: .55 }], [CUT_D + .6, 'relieved', { tint: 'blue', tintK: .25 * (1 - seg(t, CUT_D, 12)) }],
                              [BFLY + .45, 'love', { lookX: .3, lookY: -.4 }]]);   // love comes after the landing has its own read
    const aL = .15;                                                  // boat held low: the face stays visible
    // the butterfly path: flutters in from the top left and lands on the sail tip (computed from the same pose)
    const th = .7 - aL, tip = [X + (1.6 + 2.1 * Math.cos(th)) * u, Y + 2 * u - 4.2 * u + 2.1 * Math.sin(th) * u], sail = [tip[0] + 2, tip[1] + 6 - 96 * .8];
    const fk = seg(t, 11.0, BFLY), fx = lerp(220, sail[0], easeOut(fk)) + 60 * Math.sin(fk * 9) * (1 - fk), fy = lerp(160, sail[1] - 26, ease(fk)) + 40 * Math.sin(fk * 13) * (1 - fk);
    boilSeed('sitShadow'); paint(ellPts(X, Y + 6, 4.2 * u, .8 * u, 20), { fill: PAL.ink, fillOp: 90, bleed: .2, tex: .3, ink: null });
    clawd(X, Y + 2 * u, u, { ...mood, view: 'side', aL, noLegs: true, noShadow: true, armL: (uu, sw) => { push(); rotate(-th); boat(0, 6, .8, -.04 + .03 * wob(t, .5), 'boatD'); pop(); } });
    if (t > 11.0) { butterfly(fx, fy, 1.8, t, t >= BFLY); focus('butterfly', fx, fy, 64 * 1.8, 46 * 1.8); }
    focusClawd('clawd', X, Y, u, { sit: true });
    const at = toScreen(tip[0], tip[1] - 40);
    camEnd();
    shade('rays', { t, k: .35 * ease(seg(lt, .2, 1.4)), at: [1500, 170], r: 900, c1: '#FFE3A0', seed: 2 });
    rain(t, 1 - seg(lt, 0, .5));                                                                    // the last drops
    if (lt < .3) brushWipe(.5 + lt / .6, ['#E8AA38', '#F2C59B']);                                   // transition in: the wipe drags off
    if (lt > dur - .8) iris(...at, lerp(1500, 0, easeIn(seg(lt, dur - .8, dur - .05))));           // transition out: iris on boat and Clawd
  }
  shots([[0, shotA], [CUT_B, shotB], [CUT_C, shotC], [CUT_D, shotD]]);

  // ---------- sound ----------
  const step = 60 / PROJECT.bpm / 2;
  const feet = []; for (let s = CUT_B + .05; s < CUT_C + .3; s += step) feet.push({ at: +s.toFixed(3), kind: 'thud', gain: .18 });
  sound([
    { at: 0, kind: 'rain', dur: CUT_D - .2, gain: .45, attack: .3, release: .9 },
    { at: 0, kind: 'pad', notes: ['D3', 'A3', 'F4'], dur: CUT_D - .5, gain: .18, attack: 1.2 },
    { at: GASP, kind: 'pop', freq: 620, gain: .45 },
    { at: CUT_B - .2, kind: 'whoosh', dur: .45, gain: .45 }, ...feet,
    { at: DIVE - .05, kind: 'whoosh', dur: .5, gain: .5 }, { at: LAND, kind: 'splash', gain: .8, size: .8 },
    { at: CUT_D - .3, kind: 'whoosh', dur: .6, gain: .35, up: false },
    { at: CUT_D, kind: 'pad', notes: ['D3', 'A3', 'F#4', 'A4'], dur: END - CUT_D - .4, gain: .22, attack: 1.0 },
    { at: BFLY, kind: 'chime', note: 'A6', gain: .35 }, { at: BFLY + .45, kind: 'chime', note: 'E6', gain: .25 },   // landing, then love
  ]);
})();
