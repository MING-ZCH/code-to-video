// pc-still: see STORYBOARD.md. Loaded before the engine.
// Pure code + asset library, no capture: Poly Haven scans laid out on a table by a solver (scale check, overlap
// resolution, rigid-body settling) or naively; rendered by Blender Cycles / EEVEE and by three.js (raster, path traced).
const PROJECT = {
  duration: 4, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { layer: 'still_solved', caption: true },
};
