// film-street: see STORYBOARD.md. Loaded before the engine.
// The woman from film-cafe walks home down a cobbled street at night: Rocketbox avatar + motion-captured walk (MIT),
// Poly Haven cobblestone_street_night HDRI (CC0) with a shadow catcher; the forward speed comes from the walk itself
// (the planted foot must not slide), tracking camera, Cycles.
const PROJECT = {
  duration: 6, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { layer: 'street', caption: true },
};
