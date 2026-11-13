// real-physics: see STORYBOARD.md. Loaded before the engine.
// A path-traced, rigid-body title (Blender layer, blender/drop.py) composited with type and grade. The 3D variants are
// separate rendered layers; `variant` picks one, so c2v pairs can pair them like any other edit.
const PROJECT = {
  duration: 6, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: {
    variant: 'gold',            // gold | glass | rubber | moon  (layer drop_<variant>)
    subtitle_zh: '重力', caption: true,
    temp: .08,
  },
};
