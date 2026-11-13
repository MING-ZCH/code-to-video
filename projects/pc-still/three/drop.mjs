// pc-still drop: the solved still life in three.js; the apple is dropped onto the plate's front rim with a little
// sideways speed and collides with the lemon, pomegranate and plate (Rapier, deterministic build). "keyframed" moves
// it on a straight eased line to the plate centre instead, as an animation that ignores the other objects would.
import { resolve } from 'node:path';
export const PARAMS = { mode: 'physics', from: [0.20, 1.02, 0.07], vel: [-0.25, 0, -0.18], to: [0.13, 0.865, -0.02] };
export function sim(ctx) {
  return {
    glb: resolve(ctx.pdir, 'out/still_solved.glb'), hdr: resolve(ctx.pdir, 'assets/room/env.hdr'),
    dynamic: ['food_apple_01', 'lemon', 'food_pears_asian_01_a', 'food_pears_asian_01_c'],
    drop: { name: 'food_apple_01', from: ctx.P('from'), vel: ctx.P('vel'), to: ctx.P('to') }, mode: ctx.P('mode'),
  };
}
