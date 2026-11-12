// main.js: the Cycles layer, graded; `style` restyles it (oil / inkwash / none) as real-motion does with footage.
(() => {
  const ZH = '"PingFang SC", sans-serif';
  function main(t, lt, dur) {
    footage(P('human'), t, 0, 0, W, H);
    if (P('style') !== 'none') stylize(P('style'), { k: 1, t: onTwos(t), r: 7 });
    grade({ t, filmic: .4, contrast: 1.05, temp: .1, bloom: .2, bloomThr: .8, vignette: .35, grain: .04, letterbox: .055,
      fade: Math.max(1 - ease(seg(lt, 0, .5)), ease(seg(lt, dur - .5, dur))) });
    const a = P('title') ? ease(seg(lt, .4, 1.0)) * (1 - ease(seg(lt, 3.2, 3.8))) : 0;
    if (a > .01) {
      textBlock('大回环 · 代码渲染', 96, 900, { size: 34, weight: 600, font: ZH, color: '#F6F1E7', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
      textBlock((P('human') === 'giant_rb' ? 'Rocketbox 扫描贴图人体' : 'MPFB 人体') + ' + 能量守恒计时的绕杠转动（Blender Cycles）', 96, 944, { size: 20, weight: 500, font: ZH, color: '#E2DBCF', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
    }
  }
  shots([[0, main]]);
})();
