// main.js: NASA launch footage with facts quoted from its own metadata. See STORYBOARD.md.
(() => {
  const F = ASSET_META.launch.facts, CLIP_START = ASSET_META.launch.start;
  const pad = (F.description.match(/Launch Complex \w+/) || [''])[0], site = (F.description.match(/Kennedy Space Center/) || [''])[0];
  const vehicle = /Space Launch System/.test(F.description) ? 'SLS · Orion' : '';
  const L = P('lang') === 'zh'
    ? { mission: 'Artemis I 发射', date: '日期', pad: '发射台', src: 'NASA 影像 · 公有领域' }
    : { mission: 'Artemis I launch', date: 'Date', pad: 'Pad', src: 'NASA footage · public domain' };
  const EN = '"Avenir Next", "Helvetica Neue", Arial, sans-serif', ZH = '"PingFang SC", "Hiragino Sans GB", sans-serif', MONO = '"SF Mono", Menlo, monospace';
  const srcT = t => P('st0') + t * P('speed');                        // absolute source second
  const shade = { glow: 'rgba(0,0,0,.75)', glowR: 12 };

  function main(t, lt, dur) {
    const st = srcT(t), up = ease(seg(st, P('liftoff_st') + .5, P('liftoff_st') + 6)), hh = handheld(t, .6, 7);
    camBegin(960 + hh.x, 560 + hh.y - 140 * up, 1.06 + .1 * ease(seg(lt, 0, dur)), hh.r);
    footage('launch', st - CLIP_START, 0, 0, W, H);
    camEnd();
    grade({ t, filmic: .5, contrast: 1.08, sat: 1.0, temp: .05, bloom: .45, bloomThr: .7, halation: .35, ca: 1.0, vignette: .45, grain: .05, letterbox: .05,
      fade: Math.max(1 - ease(seg(lt, 0, .5)), ease(seg(lt, dur - .5, dur))) });

    const a = ease(seg(lt, .4, 1.0)) * (1 - ease(seg(lt, dur - .8, dur - .4)));
    if (a > .01) {
      const lab = (txt, x, y, size, font, col, al) => { textBlock(txt, x, y, { size, weight: 600, font, color: col, alpha: al, screen: true }); Object.assign(LETTERS.at(-1), shade); };
      lab(L.mission, 96, 120, 44, P('lang') === 'zh' ? ZH : EN, '#F7F2EA', a);
      lab(vehicle, 96, 172, 26, EN, '#E6DED0', a);
      lab(`${L.date}  ${F.date}`, 96, 214, 24, P('lang') === 'zh' ? ZH : EN, '#E6DED0', a * ease(seg(lt, .8, 1.3)));
      lab(`${L.pad}  ${pad} · ${site}`, 96, 250, 24, P('lang') === 'zh' ? ZH : EN, '#E6DED0', a * ease(seg(lt, 1.1, 1.6)));
      lab(`${L.src} · ${F.center}`, 96, 980, 18, P('lang') === 'zh' ? ZH : EN, '#CFC7B9', a * .9);
    }
    // mission clock from the source's own timeline: T- before liftoff, T+ after
    if (P('clock') && a > .01) {
      const dt = st - P('liftoff_st'), s = Math.abs(dt), txt = `T${dt < 0 ? '−' : '+'}${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
      textBlock(txt, 1820, 120, { size: 46, weight: 600, align: 'center', font: MONO, color: dt < 0 ? '#F7F2EA' : '#FFC46B', alpha: a, screen: true });
      Object.assign(LETTERS.at(-1), { ...shade, align: 'right' });
    }
  }
  shots([[0, main]]);
})();
