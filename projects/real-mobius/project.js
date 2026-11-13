// real-mobius: see STORYBOARD.md. Loaded before the engine.
// World knowledge by construction: the strip is its parametric definition (one surface, one edge) and the ant walks the
// centre line on the surface normal, so it reaches the "other face" after one turn and its start after two.
const PROJECT = {
  duration: 8, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true, params: { counter: true },
};
