// main.js: title card → three cuts of the film → credit card. One timeline maps video time to source time; subtitles
// are keyed to source time, so they follow the cuts.
(() => {
  const ZH = '"PingFang SC", sans-serif', EN = '"Baskerville", "Times New Roman", serif';
  const CUTS = P('cuts'), LEAD = P('lead'), TAIL = P('tail');
  const starts = []; { let a = LEAD; for (const [s, e] of CUTS) { starts.push(a); a += e - s; } }
  const END = starts.at(-1) + CUTS.at(-1)[1] - CUTS.at(-1)[0];
  const srcAt = t => { for (let i = CUTS.length - 1; i >= 0; i--) if (t >= starts[i]) return CUTS[i][0] + (t - starts[i]); return null; };
  function print(t, st) {
    const hh = handheld(t, .6 * P('weave'), 7);                    // gate weave: the print moving in the projector
    camBegin(960 + hh.x, 540 + hh.y, 1.0, hh.r * .3);
    footage('hgf', st, 240, 0, 1440, 1080);                      // 4:3 film centred, pillarboxed
    camEnd();
  }
  function finish(t, o = {}) {
    const flicker = .06 * Math.sin(t * 47) * Math.sin(t * 13.3);
    grade({ t, filmic: .35, contrast: 1.12, sat: 0, exposure: flicker + (o.exposure || 0), vignette: .55, grain: P('grain'), scratch: P('scratch'),
      fade: o.fade || 0 });
  }
  function subs(st) {
    const s = P('subs').find(([a, b]) => st >= a && st < b); if (!s) return;
    const a = Math.min(1, (st - s[0]) / .12, (s[1] - st) / .12);
    textBlock(s[2], 960, 948, { size: 30, weight: 500, align: 'center', font: EN, color: '#F4F1EA', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.9)', glowR: 8 });
    textBlock(s[3], 960, 998, { size: 30, weight: 500, align: 'center', font: ZH, color: '#F4F1EA', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.9)', glowR: 8 });
  }
  function card(t, lines, lt, dur) {
    background(8);
    finish(t, { fade: Math.max(1 - ease(seg(lt, 0, .4)), ease(seg(lt, dur - .4, dur))) });
    lines.forEach(([txt, y, size, font, col], i) => {
      const a = ease(seg(lt, .2 + i * .25, .7 + i * .25));
      textBlock(txt, 960, y, { size, weight: 500, align: 'center', font, color: col, alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { track: 6 * (1 - a) });
    });
  }
  function title(t, lt, dur) {
    if (!P('title')) { background(0); return; }
    card(t, [['HIS GIRL FRIDAY', 470, 92, EN, '#F2EEE4'], ['女友礼拜五 · 1940', 572, 40, ZH, '#D9D2C4'], ['Howard Hawks · Cary Grant · Rosalind Russell', 640, 26, EN, '#B9B2A4']], lt, dur);
  }
  function film(t) {
    const st = srcAt(t); print(t, st);
    const cutIn = starts.reduce((m, s) => (t >= s ? s : m), 0);
    finish(t, { fade: 1 - ease(seg(t - cutIn, 0, .08)) * (t < LEAD + .5 ? ease(seg(t, LEAD, LEAD + .5)) : 1) });
    subs(st);
  }
  function credit(t, lt, dur) {
    card(t, [['公有领域影片 · Internet Archive (Public Domain Mark 1.0)', 500, 30, ZH, '#E6E0D4'], ['剪辑、构图、调色、字幕：代码生成（Whisper 转写 + 人工校对）', 560, 26, ZH, '#BDB6A8']], lt, dur);
  }
  shots([[0, title], [LEAD, film], [END, credit]]);
})();
