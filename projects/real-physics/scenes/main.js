// main.js: the Blender layer is the picture; the code adds the type that explains it and the finish. See STORYBOARD.md.
(() => {
  const V = P('variant'), LAYER = 'drop_' + V;
  // what the layer shows, stated as facts: the caption must match the simulation's own parameters (render meta)
  const FACTS = {
    gold: { g: 9.81, where: '地球 · Earth', mat: '金 · gold' },
    glass: { g: 9.81, where: '地球 · Earth', mat: '玻璃 · glass' },
    rubber: { g: 9.81, where: '地球 · Earth', mat: '橡胶 · rubber' },
    moon: { g: 1.62, where: '月球 · Moon', mat: '金 · gold' },
  }[V];
  const EN = '"Avenir Next", "Helvetica Neue", Arial, sans-serif', ZH = '"PingFang SC", "Hiragino Sans GB", sans-serif';

  function main(t, lt, dur) {
    const m = ASSET_META[LAYER];
    footage(LAYER, t, 0, 0, W, H);
    grade({ t, filmic: .25, contrast: 1.04, sat: 1.02, temp: P('temp'), bloom: .3, bloomThr: .8, halation: .1, vignette: .35, grain: .035,
      fade: Math.max(1 - ease(seg(lt, 0, .5)), ease(seg(lt, dur - .5, dur))) });
    // the caption states the gravity the layer was simulated with
    const c = ease(seg(lt, 3.4, 3.9)) * (1 - ease(seg(lt, dur - .7, dur - .3)));
    if (P('caption') && c > .01) {
      textBlock(`g = ${FACTS.g.toFixed(2)} m/s²`, 960, 900, { size: 40, weight: 600, align: 'center', font: EN, color: '#F4EFE6', alpha: c, screen: true });
      Object.assign(LETTERS.at(-1), { track: 3, glow: 'rgba(0,0,0,.6)', glowR: 16 });
      textBlock(`${P('subtitle_zh')} · ${FACTS.where} · ${FACTS.mat}`, 960, 956, { size: 24, weight: 500, align: 'center', font: ZH, color: '#E2DBCF', alpha: c, screen: true });
      Object.assign(LETTERS.at(-1), { track: 4, glow: 'rgba(0,0,0,.6)', glowR: 14 });
    }
    if (m.params && Math.abs((m.params.gravity ?? 9.81) - FACTS.g) > 1e-6) throw new Error(`caption g=${FACTS.g} ≠ layer gravity ${m.params.gravity}`);
  }
  shots([[0, main]]);
})();
