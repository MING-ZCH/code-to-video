// real-domino: see STORYBOARD.md. Loaded before the engine.
// A Cycles + Bullet layer (blender/heart.py); `layer` picks the rendered physics variant (heart = wood on wood,
// heart_slick = low friction, high restitution), so c2v pairs pairs physical edits like any other.
const PROJECT = {
  duration: 7, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { layer: 'heart' },
};
