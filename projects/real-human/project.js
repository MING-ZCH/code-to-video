// real-human: see STORYBOARD.md. Loaded before the engine.
// Two Cycles layers: an anthropomorphic toy robot acting on a desk (blender/robot.py) and a mocap-driven 3D dancer
// (blender/dance.py). `robot` / `dancer` pick the rendered variant of each, so c2v pairs pairs them like any edit.
const PROJECT = {
  duration: 11, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { robot: 'robot_toy', dancer: 'dance', caption: true },
};
