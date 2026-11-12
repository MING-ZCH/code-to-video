// main.js: the Cycles layer plus a lap counter computed from the same laps parameter the ant was animated with.
(() => {
  const M = ASSET_META.mobius, LAPS = M.params.laps, EN = '"Avenir Next", "Helvetica Neue", Arial, sans-serif', ZH = '"PingFang SC", sans-serif';
  function main(t, lt, dur) {
    footage('mobius', t, 0, 0, W, H);
    grade({ t, filmic: .2, contrast: 1.04, bloom: .2, bloomThr: .85, vignette: .3, grain: .025,
      fade: Math.max(1 - ease(seg(lt, 0, .4)), ease(seg(lt, dur - .4, dur))) });
    if (!P('counter')) return;
    const laps = LAPS * clamp(t / (M.dur - 1 / M.fps)), a = ease(seg(lt, .4, .9)) * (1 - ease(seg(lt, dur - .6, dur - .2)));
    const face = Math.floor(laps) % 2 ? '另一面' : '起始面';
    textBlock(`圈数 ${laps.toFixed(1)} / ${LAPS}`, 96, 110, { size: 34, weight: 600, font: ZH, color: '#F2EEE6', alpha: a, screen: true });
    textBlock(`${face} · 每走 2 圈回到起点`, 96, 160, { size: 22, weight: 500, font: ZH, color: '#CFC9BE', alpha: a, screen: true });
    textBlock('×4 speed', 1824, 110, { size: 26, weight: 600, font: EN, color: '#F2C14E', alpha: a, screen: true });
    Object.assign(LETTERS.at(-1), { align: 'right' });
  }
  shots([[0, main]]);
})();
