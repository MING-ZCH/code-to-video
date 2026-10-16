// project.js: one per project. Loaded BEFORE the engine (engine/core.js reads PROJECT at load time).
//   duration: length in seconds · bpm/offset: the pulse everything moves to · audio: path relative to the repo root
//   scenes: scene files in this project's scenes/ folder, in order
const PROJECT = { duration: 11, bpm: 120, offset: 0, scenes: ['demo.js'] };
