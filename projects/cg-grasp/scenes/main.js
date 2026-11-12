// main.js: the Cycles layer, graded, with a caption naming the grip variant.
(() => {
  const ZH = '"PingFang SC", sans-serif';
  function main(t, lt, dur) {
    footage(P('layer'), t, 0, 0, W, H);
    grade({ t, filmic: .35, contrast: 1.04, temp: .06, bloom: .15, bloomThr: .85, vignette: .3, grain: .03, letterbox: .055,
      fade: Math.max(1 - ease(seg(lt, 0, .4)), ease(seg(lt, dur - .4, dur))) });
    const a = P('caption') ? ease(seg(lt, .3, .8)) * (1 - ease(seg(lt, 2.0, 2.4))) : 0;
    if (a > .01) {
      textBlock(P('layer') === 'grasp_naive' ? '固定握姿：手指按固定角度合拢' : '接触求解：每节手指停在杯面', 96, 900, { size: 34, weight: 600, font: ZH, color: '#F6F1E7', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
      textBlock('扫描茶杯 + 照片贴图人手 · 同一手腕轨迹与时序（Blender Cycles）', 96, 944, { size: 20, weight: 500, font: ZH, color: '#E2DBCF', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
    }
  }
  shots([[0, main]]);
})();
