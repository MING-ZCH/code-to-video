// doc-card: a Chinese rich-text card → video. Shots, reads, framing: ../STORYBOARD.md.
// World = card pixels (1080×1440) placed at (420, -180) so the card is centred around x = 960. Text positions are the
// card's own (OCR boxes from input/layout-richtext.png.json); the words are the card's, typed from the source.
(() => {
  const OX = 420, OY = -180, CW = 1080, CH = 1440, U = 22;
  const at = (x, y) => [OX + x, OY + y];
  const C = { coral: '#ff6b4a', cream: '#fffaf2', hi: '#ffe08a', blue: '#5b7cfa', blueBg: '#eef4ff', ink: '#222222', sub: '#666666', quote: '#2a3f9e' };
  const TIPS = [['① 每个镜头只讲一件事', '观众需要 1.5–4 秒读懂它', 240], ['② 用动作代替文字', '把“说明”变成角色的表演', 418], ['③ 切点前要有动作', '没有动作的切点会显得生硬', 596]];
  const QUOTE = [60, 806, 960, 260];
  const T1 = 2.7, HIT = 3.8, T2 = 6.0, HL = 6.9, BUB = 7.3, POP = 8.1, T3 = 9.7, DEAD = 10.3, WAVE = 10.9, QT = 11.2;

  function card(t, o = {}) {
    boilSeed('desk'); paint(rectPts(-800, -900, 3600, 2900), { wash: '#e7dfd0', ink: null });
    boilSeed('shadow'); paint(rrPts(OX + 14, OY + 18, CW, CH, 18), { wash: '#cfc5b3', ink: null });
    boilSeed('card'); paint(rrPts(OX, OY, CW, CH, 18), { wash: C.cream, ink: PAL.ink, sw: 1 });
    const band = o.band ?? 1; if (band > .02) { boilSeed('band'); paint(rectPts(OX, OY, CW * band, 180), { wash: C.coral, ink: null }); }
    textBlock('3 个让视频不再像PPT的小技巧', ...at(60, 100), { size: 58, weight: 700, color: '#ffffff', reveal: o.title ?? 1 });
    TIPS.forEach(([a, b, y], i) => {
      const r = o.tips ? o.tips[i] : 1;
      if (i === 1 && (o.hl ?? 1) > .03) marker(...at(62, y - 12), 470, 70, o.hl ?? 1, C.hi);
      textBlock(a, ...at(70, y + 26), { size: 52, weight: 700, color: C.ink, reveal: seg(r * 2, 0, 1) });
      textBlock(b, ...at(110, y + 100), { size: 40, color: C.sub, reveal: seg(r * 2 - 1, 0, 1) });
      focus('tip' + (i + 1), OX + 330, OY + y + 60, 620, 150, { min: 300, words: [a.slice(2, 6)] });
    });
    const q = o.quote ?? 1;
    const qh = QUOTE[3] * ease(seg(q * 3, 0, 1));                                        // the box draws down; skip it while it has no height
    if (qh > 30) { boilSeed('quote'); paint(rrPts(...at(QUOTE[0], QUOTE[1]), QUOTE[2], qh, 28), { wash: C.blueBg, ink: C.blue, sw: 1.4 }); }
    if (q > 0) {
      textBlock('“Show it, don\'t write it.”', ...at(100, 890), { size: 54, weight: 700, color: C.quote, reveal: seg(q * 3 - 1, 0, 1) });
      textBlock('—— 动画师的第一条规则', ...at(100, 980), { size: 40, color: '#5b6aa8', reveal: seg(q * 3 - 2, 0, 1) }); }
    focus('quote', OX + 540, OY + 936, 960, 260, { min: 300, words: ['show it'] });
    textBlock('#动画 #短视频 #创作笔记', ...at(70, CH - 70), { size: 34, color: C.coral, alpha: o.tags ?? 1 });
    focus('title', OX + 460, OY + 100, 800, 90, { min: 300, words: ['title'] });
  }
  // a little "1.5–4 s" timer: an arc that fills over 4 s, with a tick every second
  function timer(t, x, y, r) {
    const k = seg(t, HIT, HIT + 1.6), ang = k * TAU, app = backOut(seg(t, HIT - .3, HIT)); if (app < .05) return;   // pops in with the finger
    r *= app; boilSeed('timerBg'); paint(ellPts(x, y, r, r, 36), { wash: '#ffffff', ink: PAL.ink, sw: 1.1 });
    if (k > 0) { const P = [[x, y]]; for (let i = 0; i <= 36; i++) { const a = -Math.PI / 2 + ang * i / 36; P.push([x + Math.cos(a) * r * .86, y + Math.sin(a) * r * .86]); }
      boilSeed('timerFill'); paint(P, { wash: k > 1.5 / 4 ? '#7fd38a' : '#ffcf8a', ink: null }); }
    textBlock(`${(k * 4).toFixed(1)} s`, x, y + r + 40, { size: 34, weight: 700, align: 'center', color: PAL.ink });
    focus('timer', x, y, 2 * r, 2 * r, { min: 120 });
  }

  // ---------- A ----------
  function shotA(t, lt, dur) {
    const k = ease(seg(t, .6, 2.2)); camBegin(lerp(960, 900, k), lerp(540, 60, k), lerp(.7, 1.15, k));
    card(t, { band: ease(seg(t, .15, .7)), title: seg(t, .9, 1.9), tips: [0, 0, 0], hl: 0, quote: 0, tags: 0 });
    const peek = backOut(seg(t, 1.5, 1.9)), o = { ...emotions(t, [[0, 'thinking', { lookX: -.8 }], [1.9, 'happy', { lookX: -.8 }]]), view: 'q', flip: true };
    clawd(OX + CW + 140 - 120 * peek, OY + 210, U, o); focusClawd('clawd', OX + CW + 140 - 120 * peek, OY + 210, U);
    camEnd();
    if (lt < .45) brushWipe(.5 + lt / .9, [C.coral, '#ffb199']);                     // transition in: brush wipe in coral
    // transition out: camera move — B tilts down from the title to tip 1
  }
  // ---------- B ----------
  function shotB(t, lt, dur) {
    const k = ease(seg(lt, 0, .45)); camBegin(lerp(900, 900, k), lerp(60, 140, k), 1.15);
    card(t, { title: 1, tips: [seg(t, T1, T1 + .9), 0, 0], hl: 0, quote: 0, tags: 0 });
    const x = OX + CW - 150, y = OY + 330, o = { ...emotions(t, [[1.9, 'happy', { lookX: -.8 }], [T1, 'thinking', { lookX: -.8 }], [HIT, 'determined']]), view: 'front',
      aR: lerp(.2, 1.5, backOut(seg(t, HIT - .25, HIT))) };
    clawd(x, y, U, o); focusClawd('clawd', x, y, U);
    const h = clawdHand(x, y, U, o, 'R'); boilSeed('finger'); paint(rrPts(h[0] - 7, h[1] - 44, 14, 44, 7), { wash: '#d97757', ink: PAL.ink, sw: .8 });   // one finger: one thing
    timer(t, OX + 820, OY + 140 + 260, 70);
    camEnd();
    // transition out: camera move — C tilts on down to tip 2
  }
  // ---------- C ----------
  function shotC(t, lt, dur) {
    const k = ease(seg(lt, 0, .45)); camBegin(900, lerp(140, 320, k), 1.15);
    card(t, { title: 1, tips: [1, seg(t, T2, T2 + .8), 0], hl: ease(seg(t, HL, HL + .45)), quote: 0, tags: 0 });
    const x = OX + CW - 170, y = OY + 520, j = jump(t, POP + .15, POP + .75, 3.2);
    const o = { ...emotions(t, [[HIT, 'determined'], [BUB, 'confused', { lookY: -.8 }], [POP + .1, 'excited']]), view: 'front', dy: j.dy, sq: j.sq,
      aR: lerp(.2, 1.4, seg(t, POP - .25, POP)), aL: t > POP + .1 ? 1.3 : .2 };
    clawd(x, y, U, o); focusClawd('clawd', x, y, U);
    const b = backOut(seg(t, BUB, BUB + .3)) * (1 - seg(t, POP, POP + .06));          // a wordy explanation bubble, popped
    if (b > .15) { const bx = x - 60, by = y - 8 * U - 70; boilSeed('bubble'); paint(rrPts(bx - 150 * b, by - 50 * b, 300 * b, 100 * b, 30), { wash: '#ffffff', ink: PAL.ink, sw: 1 });
      paint([[bx + 30, by + 48 * b], [bx + 70, by + 48 * b], [bx + 66, by + 90 * b]], { wash: '#ffffff', ink: PAL.ink, sw: 1 });
      for (let i = 0; i < 3; i++) { boilSeed('blab' + i); inkLine([[bx - 110 * b, by - 22 * b + i * 22 * b], [bx + (i === 2 ? 30 : 110) * b, by - 22 * b + i * 22 * b]], 1.2, '#888', 'ink', 0); }
      focus('bubble', bx, by, 300, 100, { min: 120, words: ['bubble'] }); }
    if (t > POP && t < POP + .5) for (let i = 0; i < 8; i++) { const a = i * TAU / 8, r = 40 + 160 * seg(t, POP, POP + .5); boilSeed('pf' + i);
      paint(ellPts(x - 60 + Math.cos(a) * r, y - 8 * U - 70 + Math.sin(a) * r, 8, 8, 10), { wash: '#ffffff', ink: PAL.ink, sw: .6 }); }
    camEnd();
    if (lt > dur - .25) whipPan(easeIn(seg(lt, dur - .25, dur)), 1, C.coral);       // transition out: whip pan
  }
  // ---------- D ----------
  function shotD(t, lt, dur) {
    const pb = ease(seg(t, 12.5, 13.4)); camBegin(lerp(900, 960, pb), lerp(kf(t, [[9.4, 540], [QT - .2, 540], [QT + .4, 760]]), 540, pb), lerp(1.15, .62, pb));
    card(t, { title: 1, tips: [1, 1, seg(t, T3, T3 + .8)], hl: 1, quote: seg(t, QT, QT + 1.2), tags: ease(seg(t, 12.6, 13)) });
    // the dead cut vs the cut with action: a two-panel mini storyboard beside tip 3
    const px = OX + 600, py = OY + 640, freeze = t > DEAD && t < WAVE;
    focus('cuts', px + 180, py + 60, 360, 120, { min: 200, words: ['切点'] });                  // the two-panel example is what tip 3's read is about
    for (const [i, x] of [[0, px], [1, px + 190]]) { boilSeed('mini' + i); paint(rrPts(x, py, 170, 120, 10), { wash: i ? '#e4f6e6' : '#fbe4e0', ink: PAL.ink, sw: .9 }); }
    clawd(px + 85, py + 104, 9, { ...feel(freeze ? 'nervous' : 'neutral', t), view: 'front', boilKey: 'mini0', lite: true, noShadow: true });
    clawd(px + 190 + 85, py + 104, 9, { ...feel('happy', t), view: 'front', boilKey: 'mini1', aR: 1 + .5 * Math.sin(t * 12), lite: true, noShadow: true });
    const o = { ...emotions(t, [[9.4, 'excited', { fresh: true }], [T3 + .4, 'thinking', { lookX: -.5 }], [QT + .5, 'proud']], { fresh: true }), view: 'front' };
    const hop = seg(t, QT + .1, QT + .6), [cx, cy] = hop < 1 ? arcPt([OX + 1180, OY + 760], [OX + CW - 110, OY + 1180], 120, ease(hop)) : [OX + CW - 110, OY + 1180];   // right of the cut example (off the card's edge), then hops down past the quote
    clawd(cx, cy, U, { ...o, ...(hop > 0 && hop < 1 ? { sq: -.12 } : {}) }); focusClawd('clawd', cx, cy, U);
    camEnd();
    if (lt < .25) whipPan(1 - easeOut(lt / .25), 1, C.coral);                       // transition in: the whip lands
    if (lt > dur - .6) iris(W / 2, H / 2, lerp(1300, 0, easeIn(seg(lt, dur - .6, dur - .05))));   // transition out: iris close
  }
  shots([[0, shotA], [2.4, shotB], [5.8, shotC], [9.4, shotD]]);
  const typing = (t0, n) => Array.from({ length: n }, (_, i) => ({ at: t0 + i * .07, kind: 'click', gain: .15 }));
  sound([{ at: .15, kind: 'whoosh', dur: .5, gain: .3 }, ...typing(.9, 13), { at: 1.6, kind: 'pop', freq: 700, gain: .3 },
    ...typing(T1, 12), ...[0, 1, 2, 3].map(i => ({ at: HIT + i * .4, kind: 'click', gain: .35 })), { at: HIT + 1.6, kind: 'chime', note: 'E6', gain: .3 },
    ...typing(T2, 10), { at: HL, kind: 'whoosh', dur: .4, gain: .25, up: true }, { at: BUB, kind: 'pop', freq: 500, gain: .3 }, { at: POP, kind: 'pop', freq: 900, gain: .45 },
    { at: POP + .15, kind: 'tone', freq: 300, glide: 700, dur: .35, wave: 'sine', gain: .3 }, { at: 9.15, kind: 'whoosh', dur: .4, gain: .35 },
    ...typing(T3, 10), { at: DEAD, kind: 'tone', freq: 500, glide: 120, dur: .25, wave: 'square', gain: .12 }, { at: WAVE, kind: 'chime', note: 'C6', gain: .25 },
    ...typing(QT + .4, 14), { at: QT + 1.2, kind: 'chime', note: 'G6', gain: .35 },
    { at: 0, kind: 'pad', notes: ['D3', 'A3', 'F#4'], dur: 9.4, gain: .1, attack: 1 }, { at: 9.4, kind: 'pad', notes: ['G3', 'D4', 'B4'], dur: 4.6, gain: .13, attack: .4 }]);
})();
