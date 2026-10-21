// doc-poster: a paper poster → video. Shots, reads, props, framing: ../STORYBOARD.md.
// World = poster pixels (3200×2000). Region boxes come from input/layout-poster.pdf.json (c2v ingest), measured once and
// pasted here as constants, so the scene stays a pure function of t.
(() => {
  const PW = 3200, PH = 2000, U = 34;
  // regions (layout + colour probe of the poster)
  const TITLE = [0, 0, 3200, 281], P1 = [66, 346, 948, 1548], P2 = [1126, 346, 948, 1548], P3 = [2186, 346, 948, 1548];
  const KEY = [113, 1393, 854, 334], BOX = { parse: [1308, 568, 584, 224], plan: [1308, 968, 584, 224], render: [1308, 1368, 584, 224] };
  const AXIS = { x0: 2290, base: 1399, top: 1399 - 690 * 85 / 73.4 };            // chart baseline / y for 85 %, from the bars
  const BARS = [['slides', 41.2, 2340, '#9aa7bd'], ['video gen', 55.8, 2600, '#9aa7bd'], ['ours', 73.4, 2860, '#54a24b']];
  const MOT = ['Video models give pixels;', 'programs give editable,', 'diffable, reproducible', 'frames. We parse the poster', 'layout, then animate each', 'panel in reading order.'];
  const C = { navy: '#1f3b6f', panel: '#f4f6fa', paper: '#fbfaf7', blue: '#4c78a8', orange: '#f58518', green: '#54a24b', red: '#b4472b' };
  const mid = b => [b[0] + b[2] / 2, b[1] + b[3] / 2];
  const T_TITLE = 1.4, T_KEY = 4.8, T_PARSE = 6.9, T_PLAN = 7.9, T_REND = 8.9, LAND = 10.25, B0 = 10.3, B1 = 10.9, B2 = 11.6, PASS = 12.2;

  function posterBase(o = {}) {
    boilSeed('desk'); paint(rectPts(-2000, -1500, PW + 4000, PH + 3000), { wash: '#e9e2d4', ink: null });
    plate('poster', null, 0, 0, PW, PH, o);
    boilSeed('edge'); inkLine([[0, 0], [PW, 0], [PW, PH], [0, PH], [0, 0]], 1.4, PAL.ink, 'ink', 0);
    bars(T);                                               // the chart is ours in every shot: empty until D grows it (continuity)
  }
  // the poster's panel 2 boxes and panel 3 bars are painted over the plate so they can animate
  function methodBoxes(t) {
    for (const [i, [id, b]] of Object.entries(BOX).entries()) {
      const at = [T_PARSE, T_PLAN, T_REND][i], on = ease(seg(t, at - .15, at + .1)), pop = 1 + .08 * spring(t, at, 7, 20);
      const [cx, cy] = mid(b), w = b[2] * pop, h = b[3] * pop;
      boilSeed('box' + id); paint(rrPts(cx - w / 2, cy - h / 2, w, h, 26), { wash: mixCol('#c9cfda', [C.blue, C.orange, C.green][i], on), ink: PAL.ink, sw: 1.2 });
      textBlock(['Parse', 'Plan', 'Render'][i], cx, cy, { size: 64 * pop, weight: 800, color: '#ffffff', align: 'center' });
      if (on > .5) glow(cx, cy, 260, ['#9cc3ff', '#ffcf8a', '#9fe39a'][i], .35 * on);
      focus(id, cx, cy, w, h, { min: 150 });
    }
  }
  const RU = 21;                                                                     // Clawd's unit on the chart
  const barTop = (t, i) => { const [, v] = BARS[i], g = backOut(seg(t, [B0, B1, B2][i], [B0, B1, B2][i] + .55)); return AXIS.base - (AXIS.base - AXIS.top) * v * g / 85; };
  function bars(t, k = 1) {
    boilSeed('chartBg'); paint(rectPts(2296, 640, 830, 830), { wash: C.panel, ink: null });               // covers the plate's static bars and labels
    boilSeed('axis'); inkLine([[AXIS.x0, AXIS.top], [AXIS.x0, AXIS.base], [3110, AXIS.base]], 1.2, PAL.ink, 'ink', 0);
    BARS.forEach(([name, v, x, col], i) => {
      const g = backOut(seg(t, [B0, B1, B2][i], [B0, B1, B2][i] + .55)) * k, hv = v * g, top = AXIS.base - (AXIS.base - AXIS.top) * hv / 85;
      boilSeed('bar' + i); if (g > 0.005) paint(rectPts(x, top, 208, AXIS.base - top), { wash: col, ink: PAL.ink, sw: 1 });
      const lab = v * Math.min(1, seg(t, [B0, B1, B2][i], [B0, B1, B2][i] + .45)), ly = i === 2 ? top + 46 : top - 40;                       // 'ours' carries Clawd: its number sits inside the bar   // the number counts up, no overshoot
      if (g > .3) textBlock(lab.toFixed(1), x + 104, ly, { size: 50, weight: 800, align: 'center', color: i === 2 ? '#ffffff' : PAL.ink });
      textBlock(name, x + 104, AXIS.base + 33, { size: 30, align: 'center', color: '#444' });
    });
    const o = ease(seg(t, PASS, PASS + .4));
    if (o > 0) { textBlock('+17.6', 2964, barTop(T, 2) - 6.6 * RU - 70 - 20 * o, { size: 72, weight: 900, color: C.red, align: 'center', alpha: o }); glow(2964, 1050, 420, '#b8f0a0', .45 * o); }
    focus('bars', 2700, 1100, 820, 620, { min: 250 }); focus('ours', 2964, 1050, 208, 690, { min: 80, words: ['ours', '73.4'] });
  }

  // ---------- A ----------
  function shotA(t, lt, dur) {
    const k = ease(seg(t, .9, 2.6)), cam = [1600, lerp(1000, 60, k), lerp(.54, .66, k)];                 // ends on the whole title band, Clawd on top of the poster
    camBegin(...cam);
    posterBase();
    focus('title', ...mid(TITLE), 2497, 120, { min: 300, words: ['title', 'poster'] });
    const up = backOut(seg(t, T_TITLE, T_TITLE + .45)), o = { ...emotions(t, [[0, 'thinking', { lookY: .8 }], [T_TITLE + .6, 'surprised', { emote: '!', lookY: .9 }]]), view: 'front' };
    if (up > 0) { const y = lerp(260, 0, up); clawd(1600, y, U, { ...o, sit: true }); focusClawd('clawd', 1600, y, U, { sit: true }); }   // climbs onto the poster's top edge, above the title
    camEnd();
    if (lt < .45) iris(W / 2, H / 2, lerp(0, 1500, easeIn(lt / .45)));          // transition in: iris open
    // transition out: camera move — B continues the pan down-left onto panel 1
  }
  // ---------- B ----------
  function shotB(t, lt, dur) {
    const k = ease(seg(lt, 0, .5)), tilt = ease(seg(t, T_KEY - .4, T_KEY + .1)), cam = [lerp(1600, 560, k), lerp(60, lerp(860, 1460, tilt), k), lerp(.66, 1.15, k)];
    camBegin(...cam);
    posterBase();
    boilSeed('p1cover'); paint(rectPts(100, 540, 860, 640), { wash: C.panel, ink: null });                  // the typed lines replace the printed ones
    const typed = seg(t, 3.5, 4.6);
    MOT.forEach((s, i) => textBlock(s, 120, 600 + i * 104, { size: 46, color: '#1a1a1a', reveal: seg(typed * MOT.length - i, 0, 1) }));
    const m = ease(seg(t, T_KEY, T_KEY + .5));
    marker(KEY[0] + 30, KEY[1] + 120, KEY[2] - 60, 90, m, '#FFD98A');
    if (m > 0) textBlock('frame(t) = f(t), no model', KEY[0] + KEY[2] / 2, KEY[1] + 165, { size: 54, font: 'monospace', align: 'center', color: '#1a1a1a', weight: 700 });
    focus('keyIdea', ...mid(KEY), KEY[2], KEY[3], { min: 200, words: ['key idea', 'frame(t)'] });
    const o = { ...emotions(t, [[0, 'surprised', { emote: '!', lookY: .9 }], [3.4, 'thinking', { lookX: -.6 }], [T_KEY, 'happy', { lookX: -.8, lookY: .4 }]]), view: 'q', flip: true,
      aR: lerp(.2, 1.3, ease(seg(t, T_KEY - .3, T_KEY))) };
    clawd(880, 1330, U, o); focusClawd('clawd', 880, 1330, U);
    camEnd();
    if (lt > dur - .25) whipPan(easeIn(seg(lt, dur - .25, dur)), 1, C.navy);       // transition out: whip pan right
  }
  // ---------- C ----------
  const carry = t => kf(t, [[6.4, [1180, 760]], [T_PARSE, [1180, 760]], [T_PLAN - .2, [1180, 1160]], [T_REND - .2, [1180, 1560]], [9.35, [1180, 1560]], [9.8, [1560, 1560]]]);
  const JUMP = 9.4;
  function shotC(t, lt, dur) {
    camBegin(1600, kf(t, [[6.4, 900], [T_PLAN - .2, 1080], [T_REND - .2, 1260]]), 1.15);       // follows Clawd down the method
    posterBase();
    boilSeed('p2cover'); paint(rectPts(1290, 540, 620, 1080), { wash: C.panel, ink: null });
    methodBoxes(t);
    for (const y of [800, 1200]) inkLine([[1600, y], [1600, y + 160]], 1.6, '#333', 'ink', 0);
    const [x, y] = carry(t), hop = ring(t, [T_PLAN - .2, T_REND - .2], 7, 16);
    const j = jump(t, JUMP, JUMP + .8, 4);                                           // takes off for the chart: lands in D
    const o = { ...emotions(t, [[0, 'thinking', { fresh: true }], [T_PARSE, 'determined'], [T_REND + .2, 'excited']], { fresh: true }), view: 'q', dy: -.5 * Math.abs(hop) + j.dy, sq: j.sq, aR: 1.1, aL: lerp(.2, 1.3, seg(t, JUMP, JUMP + .2)) };
    clawd(x, y, U, o); focusClawd('clawd', x, y, U);
    const feed = seg(t, T_REND + .1, T_REND + .5);                                   // the sheet goes into Render and is consumed
    if (t > T_PARSE - .1 && feed < 1) { const h = clawdHand(x, y, U, o, 'lead'), p = [lerp(h[0], 1600, ease(feed)), lerp(h[1], 1480, ease(feed))], sc = 1 - .8 * feed;
      boilSeed('sheet'); push(); translate(...p); rotate(.2); scale(sc); paint(rectPts(-30, -40, 60, 80), { wash: '#ffffff', ink: PAL.ink, sw: .8 }); pop();
      if (feed === 0) focus('sheet', h[0], h[1], 60, 80, { held: true, min: 30, offscreenOk: true }); }
    camEnd();
    if (lt < .25) whipPan(1 - easeOut(lt / .25), 1, C.navy);                         // transition in: the whip lands
    // transition out: cut on action — Clawd's jump continues in D, landing on the chart
  }
  // ---------- D ----------
  function shotD(t, lt, dur) {
    const pb = ease(seg(t, 12.7, 13.6)), cam = [lerp(2700, 1600, pb), lerp(kf(t, [[B2, 1040], [PASS + .2, 880]]), 1000, pb), lerp(1.15, .54, pb)];   // tilts up with the green bar
    camBegin(...cam);
    posterBase();
    const fly = seg(t, 9.8, LAND), seat = [2964, Math.min(AXIS.base, barTop(t, 2))];   // the jump from C lands on the 'ours' bar, which lifts Clawd up
    const [cx, cy] = fly < 1 ? arcPt([2380, 1180], [2964, AXIS.base], 260, fly) : seat;
    const o = { ...emotions(t, [[T_REND + .2, 'excited'], [B2 + .2, 'excited', { lookX: .3, lookY: .8 }], [PASS + .3, 'proud', { emote: 'stars' }]]), view: fly < 1 ? 'q' : 'front',
      ...(fly < 1 ? { sq: -.12 } : jump(t, PASS + .05, PASS + .45, 1.6)), sit: fly >= 1, aR: 1.3, aL: lerp(.2, 1.3, seg(t, PASS, PASS + .3)) };
    clawd(cx, cy, RU, o); focusClawd('clawd', cx, cy, RU, { sit: fly >= 1 });
    camEnd();
    if (lt > dur - .6) iris(W / 2, H / 2, lerp(1300, 0, easeIn(seg(lt, dur - .6, dur - .05))));   // transition out: iris close
  }
  shots([[0, shotA], [3, shotB], [6.4, shotC], [9.8, shotD]]);
  sound([{ at: .05, kind: 'whoosh', dur: .5, gain: .25 }, { at: T_TITLE, kind: 'pop', freq: 620, gain: .35 }, { at: T_TITLE + .6, kind: 'chime', note: 'E6', gain: .3 },
    ...Array.from({ length: 22 }, (_, i) => ({ at: 3.5 + i * .05, kind: 'click', gain: .18 })), { at: T_KEY, kind: 'whoosh', dur: .45, gain: .25, up: true },
    { at: 6.15, kind: 'whoosh', dur: .4, gain: .4 }, ...[T_PARSE, T_PLAN, T_REND].map((at, i) => ({ at, kind: 'pop', freq: 520 + 120 * i, gain: .4 })),
    { at: JUMP, kind: 'whoosh', dur: .5, gain: .35, up: true }, { at: LAND, kind: 'thud', gain: .35 }, ...[B0, B1, B2].map((at, i) => ({ at, kind: 'tone', freq: 300 + 120 * i, glide: 480 + 200 * i, dur: .5, wave: 'triangle', gain: .25 })),
    { at: PASS, kind: 'chime', note: 'G6', gain: .4 }, { at: PASS + .15, kind: 'chime', note: 'B6', gain: .3 },
    { at: 0, kind: 'pad', notes: ['C3', 'G3', 'E4'], dur: 9.6, gain: .1, attack: 1 }, { at: 9.8, kind: 'pad', notes: ['F3', 'C4', 'A4'], dur: 4.2, gain: .14, attack: .4 }]);
})();
