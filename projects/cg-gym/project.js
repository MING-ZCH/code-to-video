// cg-gym: see STORYBOARD.md. Loaded before the engine.
// The real-motion gymnast rebuilt without footage: procedural bars, physics-timed giant swings, Cycles. `human` picks the
// rendered layer: giant (MPFB base mesh, procedural skin) or giant_rb (Rocketbox avatar, photographic skin textures).
const PROJECT = {
  duration: 10, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { human: 'giant', style: 'none', title: true },
};
