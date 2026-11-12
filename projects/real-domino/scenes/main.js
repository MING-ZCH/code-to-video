// main.js: the physics layer is the shot; the composite grades it and adds code sound timed from the push. See STORYBOARD.md.
(() => {
  const M = ASSET_META[P('layer')];
  function main(t, lt, dur) {
    footage(P('layer'), t, 0, 0, W, H);
    grade({ t, filmic: .2, contrast: 1.05, sat: 1.05, temp: .05, bloom: .2, bloomThr: .85, vignette: .4, grain: .03,
      fade: Math.max(1 - ease(seg(lt, 0, .4)), ease(seg(lt, dur - .4, dur))) });
  }
  // one click per plaque at the frame the simulation says it tipped past 60° (blender/heart.py measure())
  sound(M.measure.fall_frames.filter(f => f != null).map((f, i) => ({ at: (f - 1) / M.fps, kind: 'click', gain: .22 + .08 * hash(i) })));
  shots([[0, main]]);
})();
