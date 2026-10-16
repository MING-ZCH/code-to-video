// pdoom-c08: chorus 4 regenerated from lyrics + audio (case A). Shots and reads: ../STORYBOARD.md.
//   A 0–2.5 gauge pumped to bursting · B 2.5–4.5 the loom foretells · C 4.5–6.5 masked pre-training (halftone memory)
//   D 6.5–8.5 recursive self-upgrade · E 8.5–12 Ilya's door · F 12–17 pull back: it was all a show
(() => {
  const C = { red: '#C8433A', redDk: '#8E2B2A', violet: '#2B1E3A', violetLt: '#4A3560', brass: '#D7A64A', brassDk: '#9C7230', wood: '#8A5A3C', woodDk: '#5E3B27',
              cream: '#F3E2C0', gold: '#F2C14E', curtain: '#9E2A3A', curtainDk: '#6E1B2A', floor: '#5A3A2E' };
  const BT = n => OFF + n * BEAT;                                 // beat n in video time (0.094 + n·0.682)
  const FLOOR = 860;
  // story constants (picture and song share them)
  const CRACK = 2.0, WEAVE0 = 2.62, WEAVE1 = 3.9, SURPRISE = 4.0, TILES = [5.21, 5.55, 5.89, 6.23], ZOOMS = [BT(10), BT(11), BT(12)],
        OPEN = 9.6, SLAM = BT(16), FOLD = 15.2, BOW = 15.6;

  // ---------- props ----------
  function stageFloor(x0, x1, warm = 0) {
    boilSeed('back'); paint(rectPts(x0, -600, x1 - x0, FLOOR + 600), { wash: mixCol(C.violet, '#5A3A50', warm), fill: C.violetLt, fillOp: 50, bleed: .1, tex: .5, ink: null });
    boilSeed('floor'); paint(rectPts(x0, FLOOR, x1 - x0, 700), { wash: mixCol(C.floor, C.wood, warm * .5), ink: null });
    for (let x = x0; x < x1; x += 1600) inkLine([[x, FLOOR], [Math.min(x1, x + 1600), FLOOR]], 1, PAL.ink, 'ink', 0);
    for (let i = Math.floor(x0 / 260); i < x1 / 260; i++) { boilSeed('plank' + i); inkLine([[i * 260, FLOOR + 6], [i * 260 - 120, FLOOR + 240]], .5, mixCol(C.floor, PAL.ink, .4), 'inkfine', 0); }
  }
  // the alarm: a beam sweeping from a lamp at (lx, ly); world space
  function alarm(t, lx, ly, k = 1) {
    if (k <= 0) return;
    const a = Math.PI / 2 + .9 * Math.sin(t * 2.3), L = 1900, w = .16;
    boilSeed('beam'); paint([[lx, ly], [lx + Math.cos(a - w) * L, ly + Math.sin(a - w) * L], [lx + Math.cos(a + w) * L, ly + Math.sin(a + w) * L]], { wash: C.red, washOp: 70 * k, ink: null });
    boilSeed('lamp'); glow(lx, ly, 160 + 60 * pulse(t, 5), '#FF5A4A', .7 * k);
    paint(ellPts(lx, ly, 34, 26, 16), { wash: C.red, ink: PAL.ink, sw: .9 });
  }
  function gauge(x, y, s, level, crack = 0, painted = false) {      // brass thermometer on a stand; level 0..1; no numbers
    boilSeed('gauge' + x); push(); translate(x, y); scale(s);
    paint(rrPts(-60, -560, 120, 520, 40), { wash: C.brass, fill: C.brassDk, fillOp: 60, tex: .5, ink: PAL.ink, sw: 1.1 });
    paint(rrPts(-26, -530, 52, 440, 24), { wash: C.cream, ink: PAL.ink, sw: .8 });
    const top = lerp(-110, -520, clamp(level));
    paint(rrPts(-16, top, 32, -96 - top + 6, 14), { wash: C.red, ink: null });
    paint(ellPts(0, -70, 58, 58, 24), { wash: C.red, fill: C.redDk, fillOp: 60, ink: PAL.ink, sw: 1 });
    for (let i = 0; i < 6; i++) inkLine([[-60, -480 + i * 70], [-40, -480 + i * 70]], .6, C.brassDk, 'inkfine', 0);
    if (crack > 0) { const P = [[-8, -520], [6, -480], [-6, -450], [10, -410], [-4, -380]].slice(0, 1 + Math.ceil(crack * 4)); inkLine(P, 1, PAL.ink, 'ink', 0); }
    if (painted) inkLine([[-8, -520], [6, -480], [-6, -450], [10, -410]], 1.4, PAL.ink, 'dry', 0);    // the crack was paint all along
    paint(rrPts(-70, -40, 140, 40, 8), { wash: C.woodDk, ink: PAL.ink, sw: 1 });
    pop();
  }
  const pumpH = t => { const f = frac(bpOf(t)); return f < .78 ? ease(f / .78) : 1 - easeIn((f - .78) / .22); };   // slow rise, fast down-stroke that bottoms out ON the beat
  function pump(x, y, s, h) {
    boilSeed('pump'); push(); translate(x, y); scale(s);
    paint(rrPts(-26, -120, 52, 120, 10), { wash: '#6E7FA0', ink: PAL.ink, sw: 1 });
    const hy = lerp(-140, -195, h);                                 // handle travel = the arm tip's reach (Clawd's arms are short)
    inkLine([[0, -120], [0, hy]], 1.6, PAL.ink, 'ink', 0);
    paint(rrPts(-70, hy - 22, 140, 26, 10), { wash: C.wood, ink: PAL.ink, sw: 1 });
    paint(rrPts(-60, -10, 120, 18, 6), { wash: C.woodDk, ink: PAL.ink, sw: .8 });
    pop();
  }
  // the loom: frame, warp, and a tapestry whose woven picture (a giant Clawd) is revealed row by row (k 0..1)
  const CLAWD_BITMAP = ['............', '..########..', '..########..', '..#.####.#..', '..#.####.#..', '#.########.#', '..########..', '..########..', '..#.#..#.#..', '..#.#..#.#..'];
  function loom(t, x, y, k) {
    boilSeed('loomFrame');
    for (const sx of [-330, 330]) paint(rrPts(x + sx - 22, y - 620, 44, 640, 10), { wash: C.wood, fill: C.woodDk, fillOp: 50, tex: .5, ink: PAL.ink, sw: 1 });
    paint(rrPts(x - 360, y - 650, 720, 46, 12), { wash: C.wood, ink: PAL.ink, sw: 1 });
    paint(rrPts(x - 360, y - 80, 720, 40, 12), { wash: C.woodDk, ink: PAL.ink, sw: 1 });
    const tw = 560, th = 480, tx = x - tw / 2, ty = y - 600;
    boilSeed('tapestry'); paint(rectPts(tx, ty, tw, th), { wash: C.cream, fill: '#E2CFA6', fillOp: 60, tex: .6, ink: PAL.ink, sw: .8 });
    const rows = CLAWD_BITMAP.length, cols = CLAWD_BITMAP[0].length, cw = tw / cols, ch = th / rows, shown = Math.floor(k * rows + 1e-6);
    for (let r = 0; r < shown; r++) { boilSeed('row' + r); for (let c = 0; c < cols; c++) if (CLAWD_BITMAP[r][c] === '#') paint(rectPts(tx + c * cw + 2, ty + r * ch + 2, cw - 4, ch - 4), { wash: C.red, ink: null }); }
    for (let c = 0; c <= cols; c++) inkLine([[tx + c * cw, ty], [tx + c * cw, ty + th]], .35, mixCol(C.cream, PAL.ink, .35), 'inkfine', 0);   // the warp: the grid C matches on
    // the shuttle crosses on each row
    const sk = frac(k * rows), sx = lerp(tx - 60, tx + tw + 60, (Math.floor(k * rows) % 2) ? 1 - ease(sk) : ease(sk)), sy = ty + Math.min(rows - 1, Math.floor(k * rows)) * ch + ch / 2;
    if (k > 0 && k < 1) { boilSeed('shuttle'); paint(ellPts(sx, sy, 50, 16, 16), { wash: C.brass, ink: PAL.ink, sw: .9 }); }
    return { tx, ty, tw, th, cw, ch };
  }
  function door(x, y, open, light) {                              // a door hinged on its right edge; open 0..1 shows a lit gap on the left
    boilSeed('doorFrame'); paint(rectPts(x - 130, y - 380, 260, 380), { wash: '#FFF6DA', ink: null });   // the light behind it
    if (light > 0) { glow(x - 100 + 120 * open, y - 190, 260 + 380 * light, '#FFF3C0', light); }
    paint(rrPts(x - 150, y - 400, 300, 22, 6), { wash: C.woodDk, ink: PAL.ink, sw: 1 });
    for (const sx of [-150, 128]) paint(rectPts(x + sx, y - 400, 22, 400), { wash: C.woodDk, ink: PAL.ink, sw: 1 });
    const w = 256 * (1 - .82 * open), x0 = x + 128 - w;
    boilSeed('doorPanel'); paint(rectPts(x0, y - 378, w, 378), { wash: '#7A4A6A', fill: C.violetLt, fillOp: 60, tex: .5, ink: PAL.ink, sw: 1 });
    paint(ellPts(x0 + w * .15 + 6, y - 190, 9, 9, 10), { wash: C.brass, ink: PAL.ink, sw: .6 });
    if (open < .05 && light > 0) { boilSeed('gapLight'); paint(rectPts(x - 128, y - 6, 256, 8), { wash: '#FFF3C0', washOp: 220 * light, ink: null }); }
  }
  function curtains(close, warm = 1) {                           // the theatre's own curtains, in world space around the stage opening
    for (const side of [-1, 1]) {
      boilSeed('curtain' + side); const edge = 1300 + side * lerp(2300, -70, ease(close)), far = 1300 + side * 3200;   // they overlap when closed: no gap
      const P = [[far, -700], [edge, -700]]; for (let i = 0; i <= 8; i++) P.push([edge + side * 40 * Math.sin(i * 1.3), -700 + i * 200]); P.push([far, 900]);
      paint(P, { wash: C.curtain, fill: C.curtainDk, fillOp: 90, tex: .6, ink: PAL.ink, sw: 1.4 });
      for (let k = 1; k < 6; k++) inkLine([[lerp(edge, far, k / 6), -700], [lerp(edge, far, k / 6) + side * 20, 900]], .8, C.curtainDk, 'ink', .4);
    }
  }
  function proscenium() {
    boilSeed('arch'); paint(rectPts(-2600, -1300, 7800, 620), { wash: C.curtainDk, fill: C.curtain, fillOp: 70, tex: .5, ink: PAL.ink, sw: 1.4 });
    for (const sx of [-2600, 4300]) paint(rectPts(sx, -700, 900, 1700), { wash: '#3A2433', ink: PAL.ink, sw: 1.4 });
    paint(rectPts(-1700, 900, 6000, 300), { wash: C.wood, fill: C.woodDk, fillOp: 60, tex: .5, ink: PAL.ink, sw: 1.2 });   // the apron
    for (let i = 0; i < 22; i++) { boilSeed('head' + i); paint(ellPts(-1600 + i * 290 + 60 * hash(i), 1520 + 60 * hash(i + 3), 120, 140, 18), { wash: '#1E1626', ink: null }); }   // audience heads
  }

  // ---------- A: pump it ----------
  function shotA(t, lt, dur) {
    camBegin(980 + 900 * easeIn(seg(lt, dur - .2, dur)), 560, lerp(1.05, 1.18, ease(seg(lt, 0, 2.3))));
    stageFloor(-400, 3000);
    alarm(t, 960, 60);
    const level = clamp(.15 + .88 * seg(t, BT(0), BT(3) + .1)) * (1 - .04 * pulse(t, 8));
    gauge(1240, FLOOR, 1, level, seg(t, CRACK, CRACK + .3));
    pump(930, FLOOR, 1, pumpH(t));
    boilSeed('hose'); inkLine([[930, FLOOR - 30], [1050, FLOOR + 10], [1180, FLOOR - 60]], 1.6, '#3A3048', 'ink', .6);
    const mood = emotions(t, [[0, 'excited', { emote: null }], [CRACK + .1, 'nervous', { lookX: 1, lookY: -1 }]]);
    const h = pumpH(t);
    clawd(760, FLOOR, 28, { ...mood, view: 'q', aR: lerp(.2, 1.4, h), aL: lerp(.3, .9, h), dy: mood.dy + .6 * (1 - h), sq: mood.sq + .1 * (1 - h) });   // the near arm rides the handle
    camEnd();
    flash(.18 * pulse(t, 7), '#FF6A5A');                                                     // the alarm flashes on every beat
    if (lt < .3) flash(1 - lt / .3, '#FF6A5A');                                              // transition in: red alarm flash
    if (lt > dur - .2) whipPan(easeIn(seg(lt, dur - .2, dur)), 1, C.red);                    // transition out: whip pan along the beam
  }
  // ---------- B: the loom ----------
  function shotB(t, lt, dur) {
    const tilt = ease(seg(t, 3.0, 3.8)), dive = easeIn(seg(lt, dur - .3, dur));
    camBegin(960 - 600 * (1 - easeOut(seg(lt, 0, .28))), lerp(620, 470, tilt), lerp(1, 1.1, tilt) * lerp(1, 2.6, dive));   // whip lands, tilt up, then dive into the weave
    stageFloor(-600, 2600);
    alarm(t, 200, 40, .7);
    const k = seg(t, WEAVE0, WEAVE1), q = Math.floor(k * 10) / 10 + easeOut(frac(k * 10)) * .1;
    loom(t, 960, FLOOR, q);
    clawd(560, FLOOR, 18, emotions(t, [[CRACK + .1, 'nervous', { lookX: .8, lookY: -1 }], [SURPRISE, 'surprised', { lookX: .8, lookY: -1 }]]));
    camEnd();
    flash(.12 * pulse(t, 7), '#FF6A5A');
    if (lt < .28) whipPan(1 - easeOut(lt / .28), 1, C.red);                                  // transition in: whip pan lands
    // transition out: match cut — the camera dives into the warp grid; C opens on a tile grid of the same pitch
  }
  // ---------- C: masked pre-training (a memory, in halftone) ----------
  const HOLES = [[1, 1], [4, 0], [2, 3], [5, 2]];
  function shotC(t, lt, dur) {
    camBegin(960, 520, lerp(2.2, 1, easeOut(seg(lt, 0, .5))));
    boilSeed('wallBg'); paint(rectPts(-400, -300, W + 800, H + 600), { wash: '#C9B48E', ink: null });
    const gx = 960 - 3 * 150, gy = 180, tile = 150;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const hi = HOLES.findIndex(([hc, hr]) => hc === c && hr === r), filled = hi < 0 || t >= TILES[hi];
      boilSeed(`tile${r}_${c}`);
      if (filled) {
        const ft = hi < 0 ? 9 : t - TILES[hi], s = hi < 0 ? 1 : 1 + .25 * spring(t, TILES[hi], 7, 22);
        push(); translate(gx + c * tile + tile / 2, gy + r * tile + tile / 2); scale(s);
        paint(rrPts(-tile / 2 + 6, -tile / 2 + 6, tile - 12, tile - 12, 10), { wash: (r + c) % 2 ? C.cream : '#E7D2A4', ink: PAL.ink, sw: .9 }); pop();
        if (hi >= 0 && ft < .25) emote('spark', gx + c * tile + tile / 2, gy + r * tile, 40, 1 - ft / .25, ft);
      } else paint(rrPts(gx + c * tile + 6, gy + r * tile + 6, tile - 12, tile - 12, 10), { wash: '#2B2233', ink: PAL.ink, sw: .9 });   // a masked token: a hole
    }
    // the next tile flies from little Clawd's hand into its hole on an arc (one per eighth note)
    const CX = 380, CY = 980;
    TILES.forEach((tt, i) => { if (t > tt - .3 && t < tt) { const [hc, hr] = HOLES[i], p = arcPt([CX + 60, CY - 120], [gx + hc * tile + tile / 2, gy + hr * tile + tile / 2], 160, easeOut(seg(t, tt - .3, tt)));
      boilSeed('fly' + i); paint(rrPts(p[0] - 60, p[1] - 60, 120, 120, 10), { wash: C.cream, ink: PAL.ink, sw: .9 }); } });
    const toss = Math.max(0, ...TILES.map(tt => Math.exp(-Math.abs(t - (tt - .3)) * 12)));
    clawd(CX, CY, 20, { ...emotions(t, [[4.5, 'determined', { lookX: 1, lookY: -1 }], [6.25, 'proud']], { fresh: true }),   // the flashback's younger Clawd: a new timeline view: 'q', aR: lerp(.2, 1.4, toss) });
    const lastAt = toScreen(gx + HOLES[3][0] * tile + tile / 2, gy + HOLES[3][1] * tile + tile / 2);
    camEnd();
    stylize('halftone', { t, k: ease(seg(lt, 0, .4)) });                                     // the memory print style eases in (match cut lands)
    if (lt > dur - .3) iris(...lastAt, lerp(900, 0, easeIn(seg(lt, dur - .3, dur))));      // transition out: iris shut on the last tile
  }
  // ---------- D: recursive self-upgrade ----------
  function shotD(t, lt, dur) {
    const z = kf(t, [[6.5, 2.4], [ZOOMS[0], 2.4], [ZOOMS[0] + .25, 1.5], [ZOOMS[1], 1.5], [ZOOMS[1] + .25, 1.0], [ZOOMS[2], 1.0], [ZOOMS[2] + .25, .9]], backOut);
    const zk = seg(z, 2.4, .9);                                      // 0 at the tightest, 1 at the widest: the camera centre follows
    camBegin(lerp(880, 1290, zk), lerp(800, 640, zk), z);                // the last read is the biggest Clawd's face: keep it large
    stageFloor(-1400, 3800);
    const L = [[840, 12], [1010, 24], [1360, 48]];                 // three Clawds, each twice the last
    L.forEach(([x, u], i) => {
      const hit = i < 2 ? ZOOMS[i] : -1, tap = hit > 0 ? Math.exp(-Math.abs(t - hit + .08) * 14) : 0;
      const mood = i < 2 ? feel('determined', t, { lookX: 1, lookY: .4 }) : emotions(t, [[6.5, 'neutral'], [ZOOMS[2] - .05, 'starstruck']], { fresh: true });
      clawd(x, FLOOR, u, { ...mood, view: 'side', aL: i < 2 ? lerp(.1, .45, tap) : .2, boilKey: 'rec' + i, seed: i * 3,
        armL: i < 2 ? (uu, sw) => { paint(rrPts(-.2 * uu, -.25 * uu, 2.6 * uu, .5 * uu, .2 * uu), { wash: '#9AA3B5', ink: PAL.ink, sw }); } : null });
      if (i < 2 && Math.abs(t - hit) < .25) emote('spark', x + 4.6 * u, FLOOR - 1.2 * u, 1.6 * u, 1 - Math.abs(t - hit) / .25, t - hit);
    });
    camEnd();
    if (lt < .3) iris(W / 2, H / 2, lerp(0, 1400, easeIn(lt / .3)));                         // transition in: iris opens
    if (lt > dur - .2) whipPan(easeIn(seg(lt, dur - .2, dur)), 1, C.violet);                 // transition out: whip pan to the door
  }
  // ---------- E + F share one world: the door is on the theatre's stage ----------
  const DX = 1300;
  function shotE(t, lt, dur) {
    const pin = ease(seg(t, 8.8, OPEN)), [sx, sy] = shakeXY(t, t > SLAM ? 18 * Math.exp(-(t - SLAM) * 7) : 0);
    camBegin(lerp(1100, DX - 80, pin) - 500 * (1 - easeOut(seg(lt, 0, .28))) + sx, 600 + sy, lerp(1.1, 1.35, pin));
    stageFloor(-1200, 3800);
    alarm(t, 300, 60, .6);
    const open = t < OPEN ? 0 : t < SLAM ? .55 * easeOut(seg(t, OPEN, OPEN + .5)) : 0, light = t < OPEN ? .35 : t < SLAM ? 1 : .35 * seg(t, SLAM + .3, 12);
    door(DX, FLOOR, open, light);
    const walk = stroll(t, 8.6, 9.5, 820, 1040, 26);
    const mood = emotions(t, [[8.5, 'suspicious', { lookX: 1 }], [OPEN + .1, 'starstruck', { lookX: 1 }], [SLAM + .02, 'scared', { lookX: 1 }], [SLAM + .45, 'confused', { lookX: .4 }]], { fresh: true });   // a new scene after the whip
    const blown = 30 * backOut(seg(t, SLAM, SLAM + .3));
    clawd(walk.x - blown, FLOOR, 26, { ...mood, ...walk, view: t < 9.5 ? 'side' : 'q', dy: mood.dy + walk.dy, aL: t > OPEN ? .5 : .1 });
    if (t > SLAM && t < SLAM + .5) for (let i = 0; i < 6; i++) { boilSeed('dust' + i); const a = seg(t, SLAM, SLAM + .5), ang = Math.PI * (1 + i / 5);   // dust puffs on the slam
      paint(ellPts(DX + Math.cos(ang) * (60 + 140 * a), FLOOR - 20 + Math.sin(ang) * 40 * a, 26 * (1 - a) + 4, 18 * (1 - a) + 3, 12), { wash: '#B9A7B6', washOp: 220 * (1 - a), ink: null }); }
    const gapAt = toScreen(DX - 110, FLOOR - 190);
    camEnd();
    if (t > OPEN && t < SLAM) shade('rays', { t, k: .8 * easeOut(seg(t, OPEN, OPEN + .4)), at: gapAt, r: 700, c1: '#FFF3C0', seed: 4 });
    flash(.1 * pulse(t, 7), '#FF6A5A');
    if (lt < .28) whipPan(1 - easeOut(lt / .28), 1, C.violet);                               // transition in: whip pan lands on the door
    // transition out: none needed — F's pull-back starts from this exact framing (the camera move carries through)
  }
  function shotF(t, lt, dur) {
    const back = ease(seg(t, 12.0, 13.3)), inn = ease(seg(t, FOLD + .1, BOW));
    camBegin(lerp(DX - 80, 1300, back), lerp(600, 380, back) + lerp(0, 330, inn), lerp(1.35, .32, back) * lerp(1, 2.0, inn));   // transition: the camera pull-back carries out of E
    proscenium();
    stageFloor(-1700, 4300, seg(t, 12.5, 14));
    boilSeed('stagehand'); alarm(t, -900, -500, .5 * (1 - seg(t, 13, 14)));                 // the "alarm" is a stagehand's red lamp
    gauge(250, FLOOR, .9, 1, 0, true);                                                       // the cracked gauge: a painted prop
    loom(t, 2450, FLOOR, 1);
    door(DX, FLOOR, 0, .35 * (1 - seg(t, 12, 13)));
    const bow = Math.sin(Math.PI * seg(t, BOW, BOW + 1.0)), endE = 1040 - 30;      // where E left Clawd (stroll end − blown back)
    const walk = stroll(t, 13.9, FOLD, endE, DX, 26), front = t >= FOLD;
    const pose = { ...emotions(t, [[SLAM + .45, 'confused', { lookX: .4 }], [FOLD, 'happy']]), ...walk, view: front ? 'front' : walk.view, dy: .9 * bow, sq: .28 * bow, eyes: bow > .3 ? 'closed' : undefined,   // a front-view bow: dip and squash
      aL: .4 - 1.1 * bow, aR: .4 - 1.1 * bow, hat: front ? 'top' : null, boilKey: 'clawdF' };
    if (!front) clawd(walk.x, FLOOR, 26, pose);                      // on the stage, behind the closing curtains
    curtains(seg(t, 13.9, FOLD), seg(t, 12.5, 14));
    if (front) clawd(DX, FLOOR + 40, 26, pose);                      // the curtains have closed: Clawd steps out in front of them and bows
    const at = toScreen(DX, FLOOR + 40 - 110);
    camEnd();
    boilSeed('goldwash'); glow(W / 2, H * .3, 900, C.gold, .25 * seg(t, 13, 14.5));
    if (lt > dur - .6) iris(...at, lerp(1300, 0, easeIn(seg(lt, dur - .6, dur - .05))));     // transition out: iris closes on the bow
  }
  shots([[0, shotA], [2.5, shotB], [4.5, shotC], [6.5, shotD], [8.5, shotE], [12.0, shotF]]);
})();
