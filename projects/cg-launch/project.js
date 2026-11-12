// cg-launch: see STORYBOARD.md. Loaded before the engine.
// The Artemis I launch rebuilt without footage: NASA's SLS 3D model, a procedural pad, procedural exhaust volumes, Cycles.
// Facts are the NASA item's metadata (copied from projects/real-world/assets.lock.json), not typed from memory.
const PROJECT = {
  duration: 8, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true, shutter: { samples: 2, angle: .5 },
  params: { mission: 'Artemis I 发射', vehicle: 'SLS · Orion', date: '2022-11-16', pad: 'Launch Complex 39B · Kennedy Space Center', liftoff_t: 2.54, clock: true },
};
