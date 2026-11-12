// splat-garden: see STORYBOARD.md. Loaded before the engine.
// A real captured scene (Mip-NeRF 360 garden → 3D Gaussian Splatting, Brush) rendered from code by engine/splat.js:
// the camera move, recolouring, removal and inserted objects are parameters; `layer` picks the rendered variant.
const PROJECT = {
  duration: 10, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { layer: 'orbit', caption: true },
};
