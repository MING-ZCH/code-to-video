// main.js: the Cycles layer with the same labels and mission clock as real-world, for a side-by-side.
(() => {
  const EN = '"Avenir Next", "Helvetica Neue", Arial, sans-serif', ZH = '"PingFang SC", sans-serif', MONO = '"SF Mono", Menlo, monospace';
  const shade = { glow: 'rgba(0,0,0,.75)', glowR: 12 };
  function main(t, lt, dur) {
    const hh = handheld(t, .5, 3);
    camBegin(960 + hh.x, 540 + hh.y, 1.03, hh.r);
    footage('launch', t, 0, 0, W, H);
    camEnd();
    grade({ t, filmic: .45, contrast: 1.08, temp: .05, bloom: .55, bloomThr: .65, halation: .4, ca: 1.0, vignette: .45, grain: .05, letterbox: .05,
      fade: Math.max(1 - ease(seg(lt, 0, .5)), ease(seg(lt, dur - .5, dur))) });
    const a = ease(seg(lt, .4, 1.0)) * (1 - ease(seg(lt, dur - .8, dur - .4)));
    if (a > .01) {
      const lab = (txt, y, size, font, col) => { textBlock(txt, 96, y, { size, weight: 600, font, color: col, alpha: a, screen: true }); Object.assign(LETTERS.at(-1), shade); };
      lab(P('mission'), 120, 44, ZH, '#F7F2EA'); lab(P('vehicle'), 172, 26, EN, '#E6DED0');
      lab(`日期  ${P('date')}`, 214, 24, ZH, '#E6DED0'); lab(`发射台  ${P('pad')}`, 250, 24, ZH, '#E6DED0');
      lab('代码渲染 · NASA SLS 3D 模型 + 程序化发射台与尾焰（Blender Cycles）', 980, 18, ZH, '#CFC7B9');
    }
    if (P('clock') && a > .01) {
      const dt = t - P('liftoff_t'), s = Math.abs(dt), txt = `T${dt < 0 ? '−' : '+'}${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
      textBlock(txt, 1820, 120, { size: 46, weight: 600, align: 'center', font: MONO, color: dt < 0 ? '#F7F2EA' : '#FFC46B', alpha: a, screen: true });
      Object.assign(LETTERS.at(-1), { ...shade, align: 'right' });
    }
  }
  shots([[0, main]]);
})();
