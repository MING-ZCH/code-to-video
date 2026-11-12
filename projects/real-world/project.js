// real-world: see STORYBOARD.md. Loaded before the engine.
// World knowledge from the source itself: NASA footage, and on-screen facts read from the NASA item's metadata
// (ASSET_META.launch.facts), never typed from memory. The only judged value is liftoff_st (see STORYBOARD.md).
const PROJECT = {
  duration: 8, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true, shutter: { samples: 3, angle: .5 },
  params: {
    liftoff_st: 50.4,     // source second of T-0 (RS-25 glow at ~44.0 s + 6.36 s start sequence)
    st0: 46.6, speed: 1.3,
    lang: 'zh',           // zh | en: label language (facts stay as the source gives them)
    clock: true,
  },
};
