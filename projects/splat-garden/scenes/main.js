// main.js: the splat layer with a light grade and a caption naming how the picture was made.
(() => {
  const ZH = '"PingFang SC", sans-serif';
  function main(t, lt, dur) {
    footage(P('layer'), t, 0, 0, W, H);
    grade({ t, filmic: .25, contrast: 1.02, vignette: .25, grain: .02, letterbox: .055,
      fade: Math.max(1 - ease(seg(lt, 0, .5)), ease(seg(lt, dur - .5, dur))) });
    const a = P('caption') ? ease(seg(lt, .4, 1.0)) * (1 - ease(seg(lt, 3.2, 3.8))) : 0;
    if (a > .01) {
      textBlock('实拍采集 · 代码渲染', 96, 900, { size: 34, weight: 600, font: ZH, color: '#F6F1E7', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
      textBlock('185 张照片 → 3D 高斯泼溅；相机路径与编辑由代码给出（WebGL）', 96, 944, { size: 20, weight: 500, font: ZH, color: '#E2DBCF', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
    }
  }
  shots([[0, main]]);
})();
