// main.js: the chosen layer as rendered (no grade, so renderer comparisons stay as rendered), with a caption.
(() => {
  const ZH = '"PingFang SC", sans-serif';
  const CAP = { still_solved: '求解布局：尺度检查 · 去重叠 · 物理落定', still_naive: '直接摆放：按原点放置', still_naive_scaled: '直接摆放 + 统一缩放到 20 cm',
    drop_physics: 'three.js + Rapier：苹果落下并碰撞', drop_keyframed: 'three.js 关键帧：苹果直线移到盘心' };
  function main(t, lt, dur) {
    footage(P('layer'), t, 0, 0, W, H);
    const a = P('caption') ? ease(seg(lt, .3, .8)) * (1 - ease(seg(lt, 2.6, 3.0))) : 0;
    if (a > .01) {
      textBlock(CAP[P('layer')] || P('layer'), 96, 900, { size: 32, weight: 600, font: ZH, color: '#F6F1E7', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
      textBlock('Poly Haven CC0 扫描资产，纯代码布局与渲染（无采集）', 96, 944, { size: 20, weight: 500, font: ZH, color: '#E2DBCF', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.7)', glowR: 12 });
    }
  }
  shots([[0, main]]);
})();
