// doc-meme: a two-caption meme → video. Shots, reads: ../STORYBOARD.md.
// World = the meme picture scaled to 1920×1080 (×1.5). Caption boxes from input/layout-meme.png.json (×1.5).
(() => {
  const S = 1.5, U = 26;
  const CAP1 = '老板：这个需求很简单', CAP2 = '需求：';
  const THUMB = 2.3, REVEAL = 3.7, BOLT = 4.25, SLAM = 5.0, C0 = 7.2;
  const cap = (txt, x, y, size, o = {}) => textBlock(txt, x, y, { size, weight: 900, color: '#ffffff', align: 'center', ...o });
  function pic(o = {}) { plate('pic', null, 0, 0, 1280 * S, 720 * S, o); }
  function captionStroke(txt, x, y, size, o = {}) {        // meme lettering: white with a heavy black outline (letter() stroke)
    const r = o.reveal ?? 1, chars = [...txt], n = Math.floor(r * chars.length + 1e-6); if (n <= 0) return;
    letter(chars.slice(0, n).join(''), x, y, size * (o.pop ?? 1), '#ffffff', { font: `900 ${size * (o.pop ?? 1)}px ${DOC_FONT}`, stroke: '#111111', ink: false, rot: o.rot || 0, screen: o.screen });
  }
  function desk(t, k) {                                     // the desk strip Clawd stands on in A; slides away in B
    if (k <= 0) return; boilSeed('desk'); paint(rectPts(-100, 1080 - 150 * k, 2200, 260), { wash: '#a8744f', ink: PAL.ink, sw: 1.2 });
  }

  // ---------- A ----------
  function shotA(t, lt, dur) {
    camBegin(960, 240, 2.4);                                // tight on the calm sky between the drones: the "easy" part (no plate edge)
    pic();
    camEnd();
    desk(t, 1);
    const o = { ...emotions(t, [[0, 'happy', { lookX: -.3 }], [THUMB, 'proud']]), view: 'front', aR: lerp(.2, 1.6, backOut(seg(t, THUMB - .2, THUMB + .1))) };
    clawd(1440, 935, U * 1.4, o); focusClawd('clawd', 1440, 935, U * 1.4, { words: ['clawd', 'thumbs'] });
    const h = clawdHand(1440, 935, U * 1.4, o, 'R'); if (t > THUMB - .1) { boilSeed('thumb'); paint(rrPts(h[0] - 9, h[1] - 50, 18, 50, 9), { wash: '#d97757', ink: PAL.ink, sw: .9 }); }
    captionStroke(CAP1, 960, 150, 108, { reveal: seg(t, 1.2, 2.0), screen: true }); focus('caption1', 960, 150, 1050, 120, { min: 400, words: ['caption 1', 'claim'] });
    if (lt < .25) flash(1 - lt / .25, '#ffffff');                                      // transition in: flash
    // transition out: camera move — B's pull-back starts from this framing
  }
  // ---------- B ----------
  function shotB(t, lt, dur) {
    const k = easeOut(seg(t, REVEAL - .3, REVEAL + .7)), [sx, sy] = shakeXY(t, 18 * Math.exp(-6 * Math.max(0, t - SLAM)) * (t > SLAM ? 1 : 0));
    camBegin(lerp(960, 960, k) + sx, lerp(240, 540, k) + sy, lerp(2.4, 1, k));
    pic();
    focus('flood', 960, 700, 1900, 700, { min: 600, words: ['flood'] });
    camEnd();
    const b = Math.exp(-7 * Math.max(0, t - BOLT)) * (t > BOLT ? 1 : 0); if (b > .02) flash(.75 * b, '#e8f0ff');   // lightning on the beat
    desk(t, 1 - ease(seg(t, REVEAL, REVEAL + .5)));
    const o = { ...emotions(t, [[THUMB, 'proud'], [REVEAL + .2, 'surprised', { emote: '!!' }], [SLAM + .6, 'scared']]), view: 'front', ...take(t, REVEAL + .2, 1.2),
      aR: lerp(1.6, -.4, ease(seg(t, REVEAL, REVEAL + .3))) };
    const y = lerp(935, 1010, ease(seg(t, REVEAL, REVEAL + .5)));
    clawd(1440, y, U * 1.4, o); focusClawd('clawd', 1440, y, U * 1.4);
    captionStroke(CAP1, 960, 150, 108, { screen: true });
    const p = seg(t, SLAM, SLAM + .25);
    if (p > 0) { captionStroke(CAP2, 960, 930, 150, { pop: 1 + .5 * (1 - backOut(p)), rot: -.04, screen: true }); focus('caption2', 960, 930, 460, 160, { min: 200, words: ['caption 2', '需求'] }); }
    if (lt > dur - .25) whipPan(easeIn(seg(lt, dur - .25, dur)), 1, '#1d4c6c');    // transition out: whip pan down
  }
  // ---------- C ----------
  function shotC(t, lt, dur) {
    camBegin(1180, 760, 1.5);
    pic();
    boilSeed('sea'); paint(rectPts(-50, 895, 2020, 240), { wash: '#1d4c6c', ink: null });   // the picture's own burned-in subtitle band, painted over with sea
    for (let k = 0; k < 4; k++) { boilSeed('wave' + k); const P = []; for (let x = -50; x <= 1970; x += 60) P.push([x, 920 + k * 42 + 8 * Math.sin(x / 70 + t * (2 + .3 * k) + k)]); inkLine(P, 1, '#6fa3c4', 'ink', .5); }
    const bob = Math.sin(t * 3.2) * 8, x = 1240, y = 880 + bob;                   // open water, lower right: alone among the waves
    boilSeed('raft'); push(); translate(x, y + 8); rotate(.05 * Math.sin(t * 2.4)); paint(rrPts(-110, -12, 220, 24, 6), { wash: '#8a5a3c', ink: PAL.ink, sw: 1 }); pop();
    focus('raft', x, y, 220, 60, { min: 150, words: ['raft'] });
    const o = { ...emotions(t, [[C0, 'sad', { fresh: true, emote: 'sweat' }]], { fresh: true }), view: 'front', aR: 1.1 };
    const u = 17; clawd(x, y - 6, u, o); focusClawd('clawd', x, y - 6, u, { min: 150 });
    const h = clawdHand(x, y - 6, u, o, 'R'); boilSeed('lamp'); inkLine([[h[0], h[1]], [h[0], h[1] + 20]], 1, PAL.ink, 'ink', 0);
    paint(rrPts(h[0] - 14, h[1] + 20, 28, 40, 6), { wash: '#FFB347', ink: PAL.ink, sw: .8 }); glow(h[0], h[1] + 40, 120, '#FFC766', .7);
    const at = toScreen(x, y - 3 * u);
    camEnd();
    captionStroke(CAP2, 960, 930, 150, { rot: -.04, screen: true, reveal: 1 });
    if (lt < .25) whipPan(1 - easeOut(lt / .25), 1, '#1d4c6c');                   // transition in: the whip lands
    if (lt > dur - .7) iris(...at, lerp(1300, 0, easeIn(seg(lt, dur - .7, dur - .05))));   // transition out: iris on Clawd
  }
  shots([[0, shotA], [3.4, shotB], [7.2, shotC]]);
  sound([{ at: 0, kind: 'pad', notes: ['C4', 'E4', 'G4'], dur: 3.6, gain: .12, attack: .6 }, ...Array.from({ length: 10 }, (_, i) => ({ at: 1.2 + i * .08, kind: 'click', gain: .15 })),
    { at: THUMB, kind: 'chime', note: 'E6', gain: .35 }, { at: REVEAL - .2, kind: 'whoosh', dur: .7, gain: .45 }, { at: BOLT, kind: 'boom', dur: 2.2, gain: .7 },
    { at: REVEAL, kind: 'rain', dur: 6.3, gain: .35, attack: .4, release: .8 }, { at: SLAM, kind: 'thud', gain: .7 },
    { at: 7.0, kind: 'whoosh', dur: .4, gain: .35 }, ...[0, 1, 2].map(i => ({ at: 8.2 + i * .4, kind: 'tone', freq: [392, 370, 349][i], glide: [370, 349, 294][i], dur: i === 2 ? .8 : .35, wave: 'triangle', gain: .22 }))]);
})();
