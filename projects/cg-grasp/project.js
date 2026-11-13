// cg-grasp: see STORYBOARD.md. Loaded before the engine.
// Interaction realism: a photo-textured hand picks up a scanned teacup. `layer` picks the rendered variant:
// grasp_naive (cup glued to the hand, fingers in their rest pose) or grasp_solved (fingers closed onto the cup surface
// by a contact solver, cup released from the table only when the grip holds).
const PROJECT = {
  duration: 6, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: { layer: 'grasp_solved', caption: true },
};
