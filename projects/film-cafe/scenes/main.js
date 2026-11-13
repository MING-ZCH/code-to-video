// main.js: the Cycles layer with a 2.39:1 film frame, light grain, and a caption naming how it was made.
(() => {
  const ZH = '"PingFang SC", sans-serif';
  function main(t, lt, dur) {
    footage(P('layer'), t, 0, 0, W, H);
    grade({ t, filmic: .2, contrast: 1.03, vignette: .3, grain: .035, letterbox: .12,
      fade: Math.max(1 - ease(seg(lt, 0, .4)), ease(seg(lt, dur - .4, dur))) });
    const a = P('caption') ? ease(seg(lt, .3, .8)) * (1 - ease(seg(lt, 2.4, 2.8))) : 0;
    if (a > .01) {
      textBlock('咖啡馆 · 双人对话', 96, 880, { size: 32, weight: 600, font: ZH, color: '#F6F1E7', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
      textBlock('Rocketbox 动捕人物 + Poly Haven 扫描资产，纯代码布局与接触约束（Blender Cycles）', 96, 922, { size: 19, weight: 500, font: ZH, color: '#E2DBCF', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
    }
  }
  shots([[0, main]]);
})();
