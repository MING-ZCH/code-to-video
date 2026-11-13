// real-exposure: see STORYBOARD.md. Loaded before the engine.
// Double-exposure title: a profile silhouette (CC0 portrait → mask) holds a Cycles misty moor (blender/moor.py), which
// dissolves into real footage of cooling towers whose steam rises to fill the head. The mask is exact, so nothing ever
// leaves the outline.
const PROJECT = {
  duration: 12, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { bg: '#D9D0B5', dissolve: 6.0, sat: .3, scratch: .7 },
};
