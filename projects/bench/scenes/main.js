// bench: the bench meme as a six-style remix (case B). Shots and reads: ../STORYBOARD.md.
// One painted world (brush) → the blast (explosion/shockwave shaders) → bench + Clawd → the segment's style shader.
(() => {
  const SEG = 4, STYLES = ['cave', 'inkwash', 'stained', 'halftone', 'pixel', 'blueprint'];
  const CAMS = [[960, 560, 1.0], [880, 620, 1.3], [920, 540, 1.1], [880, 620, 1.3], [860, 640, 1.35], [640, 640, 1.9]];   // mediums keep Clawd (left) and the blast (right) both in frame
  const STYLE_R = [0, 0, 22, 0, 12, 0];                             // stained-glass cell / pixel block size: small enough for Clawd to read
  const HZ = 640, BLAST = [1360, HZ + 6], SEAT = 790, CX = 640, U = 26;
  const WAVE = 1.6;                                                 // the shockwave reaches the bench this long into each segment
  const HAT_OFF = 2 * SEG + WAVE + .02, SIP = 3 * SEG + 1.9,   // the hat goes when the wave hits (cause, then effect)   // (review: the sip didn't read in stained glass → swapped with the hat)
        YAWN = SEG + 1.0, TURN = 5 * SEG + .8, SHADES = 5 * SEG + 2.2;

  function world(t) {
    boilSeed('sky'); paint(rectPts(-400, -400, W + 800, HZ + 400), { wash: '#A9C4D8', fill: '#E9D6B8', fillOp: 90, bleed: .2, tex: .4, ink: null });
    boilSeed('haze'); paint(ellPts(W / 2, HZ, W * .9, 140, 30, 6), { fill: '#E8C9A0', fillOp: 110, bleed: .25, tex: .4, ink: null });
    for (let i = 0; i < 16; i++) {                                 // the city on the horizon, stable per building
      boilSeed('bld' + i); const w = 40 + 50 * hash(i), h = 50 + 130 * hash(i + 4), x = 900 + i * 60 + 20 * hash(i + 8);
      paint(rectPts(x, HZ - h, w, h + 10), { wash: mixCol('#6B7A93', '#4A556E', hash(i + 2)), ink: PAL.ink, sw: .5 });
    }
    boilSeed('hill'); paint(ellPts(760, 1240, 1500, 560, 40, 3), { wash: '#7FA05E', fill: '#5F8248', fillOp: 70, tex: .5, ink: PAL.ink, sw: 1 });
    boilSeed('tree'); paint(ellPts(220, 560, 150, 170, 22, 4), { wash: '#5F8248', fill: '#4A6B3A', fillOp: 70, tex: .5, ink: PAL.ink, sw: .9 });
    paint(rectPts(205, 640, 30, 190), { wash: '#6E4A35', ink: PAL.ink, sw: .8 });
  }
  function bench(shake) {
    boilSeed('bench'); push(); translate(shake, 0);
    for (const x of [CX - 150, CX + 130]) paint(rectPts(x, SEAT - 4, 22, 96), { wash: '#4A3A30', ink: PAL.ink, sw: .9 });
    paint(rrPts(CX - 190, SEAT - 18, 380, 26, 6), { wash: '#8A5A3C', ink: PAL.ink, sw: 1 });
    paint(rrPts(CX - 190, SEAT - 92, 380, 22, 6), { wash: '#8A5A3C', ink: PAL.ink, sw: 1 });            // a low backrest: Clawd's head and shoulders clear it
    for (const x of [CX - 170, CX + 150]) paint(rectPts(x, SEAT - 92, 16, 82), { wash: '#4A3A30', ink: PAL.ink, sw: .8 });
    pop();
  }
  function beanie(x, y, s, rot) { boilSeed('beanie'); push(); translate(x, y); rotate(rot); scale(s);
    paint(ellPts(0, 0, 60, 46, 20, 0).filter(p => p[1] <= 4), { wash: '#C8433A', ink: PAL.ink, sw: .8 }); paint(rrPts(-64, -6, 128, 22, 8), { wash: '#E8D6B8', ink: PAL.ink, sw: .8 });
    paint(ellPts(0, -50, 16, 16, 10), { wash: '#E8D6B8', ink: PAL.ink, sw: .6 }); pop(); }

  function remix(t, lt, dur) {
    const s = Math.min(5, Math.floor(t / SEG)), [cx, cy, z] = CAMS[s], push2 = 1 + .04 * lt / SEG;
    const wave = seg(lt, WAVE - .6, WAVE + .3), hitAge = lt - WAVE, shake = hitAge > 0 ? 10 * Math.exp(-hitAge * 6) * Math.sin(hitAge * 60) : 0;
    camBegin(cx, cy, z * push2); world(t); const bz = toScreen(...BLAST), zz = z * push2; if (s < 5) focus('blast', BLAST[0], BLAST[1] - 300, 520, 600, { min: 120, words: ['cloud', 'mushroom', 'blast'] }); camEnd();
    shade('explosion', { t: onTwos(t), k: seg(lt, 0, SEG + 1.4), at: bz, r: 210 * zz, c1: '#FFF6D0', c2: '#F07A2C', c3: '#6E5D68' });
    if (wave > 0 && wave < 1) shade('shockwave', { k: wave, at: bz, r: 2400 * zz, c1: '#FFF3C4' });
    camBegin(cx + shake * .3, cy, z * push2);
    bench(shake);
    // Clawd, slumped, turned away from the blast; actions per segment (see STORYBOARD)
    const view = t < TURN ? { view: 'q', flip: true } : turn(t, TURN, TURN + .3, -.125, 0);
    const mood = emotions(t, [[0, 'bored', { lookX: -.6 }], [YAWN, 'sleepy', { mouth: 'yawn', lookX: -.6 }], [YAWN + 1.2, 'bored', { lookX: -.6 }],
      [2 * SEG + .2, 'bored', { lookX: -.6 }], [SIP - .9, 'relieved', { lookX: -.4 }], [SIP + 1.1, 'bored', { lookX: -.6 }], [4 * SEG + .6, 'neutral', { lookX: -.2, lookY: .7 }],
      [TURN, 'neutral', { lookX: 0 }], [SHADES, 'cool']], { take: .4 });
    const sip = ease(seg(t, SIP - .9, SIP - .4)) - ease(seg(t, SIP + .5, SIP + 1.0)), phone = s === 4;
    const hat = t < HAT_OFF ? 'beanie' : null;
    clawd(CX + shake, SEAT + 2 * U, U, { ...mood, ...view, noLegs: true, noShadow: true, sq: (mood.sq || 0) + .12, dy: (mood.dy || 0) + .15, hat,
      aR: -.7, aL: s === 3 ? lerp(-.6, 1.25, sip) : phone ? .55 : -.6, rot: .05,           // props on the NEAR arm (aL in the flipped 3/4 view)
      armL: s === 3 ? (u, sw) => { boilSeed('mug'); paint(rrPts(-.8 * u, -2.0 * u, 2.0 * u, 2.3 * u, .3 * u), { wash: '#E8D6B8', ink: PAL.ink, sw }); inkLine([[1.2 * u, -1.6 * u], [1.8 * u, -1.2 * u], [1.2 * u, -.6 * u]], sw, PAL.ink, 'ink', .6); }
        : phone ? (u, sw) => { boilSeed('phone'); glow(0, -1.2 * u, 6 * u, '#BFE6FF', .8); paint(rrPts(-.7 * u, -2.6 * u, 1.4 * u, 2.6 * u, .2 * u), { wash: '#2B2233', ink: PAL.ink, sw }); paint(rrPts(-.5 * u, -2.4 * u, 1.0 * u, 2.1 * u, .1 * u), { wash: '#BFE6FF', ink: null }); } : null });
    if (t >= HAT_OFF && t < HAT_OFF + 1.4) { const k = seg(t, HAT_OFF, HAT_OFF + 1.4), p = arcPt([CX + 10, SEAT - 6.5 * U], [CX - 900, SEAT - 600], 260, easeOut(k)); beanie(p[0], p[1], 1, -k * 9); }
    focusClawd('clawd', CX, SEAT, U, { sit: true });
    if (s === 3 && t > SIP - .9) focus('mug', ...clawdHand(CX + shake, SEAT, U, { ...view, sit: true, aL: lerp(-.6, 1.25, sip) }, 'L'), 60, 60, { min: 40 });
    if (s === 4) focus('phone', ...clawdHand(CX + shake, SEAT, U, { ...view, sit: true, aL: .55 }, 'L'), 60, 70, { min: 40 });
    const face = toScreen(CX, SEAT - 4 * U);
    camEnd();
    stylize(STYLES[s], { t: onTwos(t), k: 1, r: STYLE_R[s] });
    if (lt < .35) flash(1 - easeOut(lt / .35));                                              // transition in: the blast's flash opens each segment
    if (lt > dur - .12) flash(easeIn(seg(lt, dur - .12, dur)));                              // transition out: the next blast's light arrives (flash cut)
    if (s === 5 && lt > dur - .8) iris(...face, lerp(1400, 0, easeIn(seg(lt, dur - .8, dur - .05))));   // transition out: iris on the shades
  }
  shots(STYLES.map((_, i) => [i * SEG, remix]));

  // ---------- sound: a boom per blast; two bars of music per style, cut with it; foley tied to the action constants ----------
  const B0 = i => i * SEG / BEAT;                                   // first beat of segment i
  sound(STYLES.map((_, i) => [{ at: i * SEG + .02, kind: 'boom', dur: 3.2, gain: .9 }, { at: i * SEG + WAVE - .3, kind: 'whoosh', dur: .5, gain: .35 }]));
  sound(beats(B0(0), 2, 'X...x.x.X...x.x.', 'kick', { gain: .6 }), beats(B0(0) + 1, 2, '..x...x...x...x.', 'clap', { gain: .35 }));                          // A cave: drums
  sound(melody(B0(1), ['E5', '-', 'G5', 'A5', '-', 'C6', 'A5', '-', 'G5', '-', 'E5', 'D5', '-', 'E5', '-', '-'], 1, { wave: 'sine', gain: .25, release: .9 }));   // B ink: pentatonic chimes
  sound([{ at: 2 * SEG, kind: 'chord', notes: ['C3', 'G3', 'E4', 'C5'], dur: 1.9, wave: 'saw', gain: .22, attack: .3, release: .6 }, { at: 2 * SEG + 2, kind: 'chord', notes: ['A2', 'E3', 'C4', 'A4'], dur: 1.9, wave: 'saw', gain: .22, attack: .3, release: .6 }]);   // C organ
  sound(beats(B0(3), 2, 'x.......x.......', 'kick', { gain: .5 }), beats(B0(3), 2, '....X.......X...', 'snare', { gain: .5 }), [0, 1, 2, 3].map(k => ({ at: 3 * SEG + .5 + k, kind: 'pop', freq: 500 + 120 * k, gain: .3 })));   // D comic
  sound(melody(B0(4), ['C5', 'E5', 'G5', 'C6', 'A4', 'C5', 'E5', 'A5', 'F4', 'A4', 'C5', 'F5', 'G4', 'B4', 'D5', 'G5'], .5, { wave: 'square', gain: .16, release: .08 }));   // E 8-bit arpeggio
  sound(melody(B0(5), ['A4', '-', '-', '-', 'E5', '-', '-', '-'], 1, { wave: 'sine', gain: .2, release: 1.2 }));                                                // F soft pulse
  sound([{ at: YAWN + .1, kind: 'tone', freq: 420, glide: 190, dur: .7, wave: 'sine', gain: .25 }, { at: SIP, kind: 'pop', freq: 380, gain: .4 },
    { at: HAT_OFF, kind: 'whoosh', dur: .6, gain: .45, up: false }, { at: 4 * SEG + 1.2, kind: 'click', gain: .35 }, { at: 4 * SEG + 2.6, kind: 'click', gain: .35 },
    { at: SHADES, kind: 'chime', note: 'E6', gain: .35 }]);
})();
