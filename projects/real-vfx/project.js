// real-vfx: see STORYBOARD.md. Loaded before the engine.
// A Cycles layer (blender/blast.py: Mantaflow fire and smoke + Bullet debris, lit by and composited into an 8k HDRI plate)
// finished in the p5 composite with impact shake, exposure flash, grade and code-synthesised sound on the same constant.
const PROJECT = {
  duration: 3.5, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { layer: 'blast2', shake: 1, flash: 1, temp: -.05 },   // blast2: blackbody flame + embers; blast: R1 version
};
