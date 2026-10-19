---
name: c2v-build
description: Implement a Code-to-Video storyboard as scene code — shot functions that are pure functions of t, painted with p5.brush (or flat/shader media), acted with emotions()/turn()/jump(), with transitions at every seam and sound events tied to the same time constants. Use after STORYBOARD.md exists; run `c2v check` until it shows 0 errors.
---

# c2v-build

## Setup

- `projects/<name>/project.js`: `duration`, `bpm`, `offset`, `scenes: [...]`, optional `medium`, `audio`, `karaoke`. Loaded before the engine.
- One scene file per chapter (or one for a short piece), an IIFE ending in `shots([[t0, fn], …])`. Never edit `engine/`; write private helpers inside your IIFE.
- Preview while building: Chrome → `studio.html?project=<name>&t=2.5`.

## Build order (per shot, in storyboard order)

1. **Set and camera**: background layers, each with its own `boilSeed('key')`; a camera that is never dead (`camBegin(cx + drift, cy, 1 + push)` … `camEnd()`).
2. **Key poses as stills** at the storyboard's read times. Check them with a sheet at exactly those times before adding motion between them.
3. **Acting**: `emotions(lt, [[t, 'mood', {overrides}], …])` for every mood change (never swap eyes/mouth by hand); `turn()` for heading changes; `jump()`, `take()`, `stroll()`, `spring()`/`ring()` for weight and follow-through; arms and props offset in time (no twinning).
4. **Transitions**: an OUT in the last ~0.3–0.7 s (`if (lt > dur - .3) brushWipe(…)`, `iris`, `flash`) and/or an IN in the first (`if (lt < .3) …`). A deliberate cut on action / smash cut / match cut gets a comment: `// transition: cut on action (the throw continues in B)`. `c2v check` judges every seam this way.
5. **Sound**: one constant per event, used by the picture and the score:

```js
const PRESS = 2.0, BOOM = 2.5;
const press = seg(lt, PRESS - .05, PRESS + .05);              // picture
sound([{ at: PRESS, kind: 'click' }, { at: BOOM, kind: 'boom', dur: 3 }]);   // sound, same constants
```

## Declare the reads, attach the props (RSI round 1)

- **`focus(id, x, y, w, h, o)`**, in world space inside the camera, for every focal element of a read. Use the id or `o.words` from the read's text. `focusClawd(id, x, y, u, { sit })` handles a character. `o.held: true` marks a carried prop; `o.min` is the minimum size in px; `o.offscreenOk` marks an element that may leave the frame on purpose. These declarations have no visual effect: `c2v reads` uses them.
- **`clawdHand(x, y, u, opts, 'near' | 'lead' | 'L' | 'R')`** gives the exact world point of a hand for any view, flip or pose. Draw rods, stems, ropes and levers *to that point*, so contact holds by construction. `'near'` is the arm drawn in front of the body. `'lead'` is the arm on the side Clawd faces: use it to hold something out toward what it looks at. (flood: a lantern on `'near'` hung behind the body in the q view.)
- **Declared box = drawn size.** The `focus()` box is what `reads` measures, so derive it from the same numbers as the drawing (night: a moon declared at twice its drawn size passed R1 while being too small).
- **A character's box is opaque (R6).** `focusClawd` boxes hide the read targets behind them. Place characters beside what the read is about, or mark a target drawn over the character `{ front: true }` (a cat in Clawd's arms, held props).
- **`clawd(x, y, u, { sit: true })`** seats the body bottom on (x, y), with no legs and a contact shadow. Don't hand-roll `y + 2u` / `noLegs`.
- **`emotions(t, keys, { fresh: true })`** marks a deliberately new timeline: a new character, or a new scene after a whip. If the same character continues across a cut, start the next shot's keys with the previous shot's last key at its original time.
- After each shot: `c2v check` (0 errors), then `c2v reads` (fix or explain every warning), then look at the frames.

## Cost (RSI round 1)

- `c2v cost <name> [--scale=.5]` times each shot's midpoint. **R5** flags a shot ≥ 2.2× the median.
- Tag parts with `if (!skipped('smalls')) …`, then run `c2v cost <name> --skip=smalls,rain` to see what each part costs.
- In watercolour, small characters are expensive: about 4 s per small Clawd per frame on the VM. Use `clawd(x, y, u, { lite: true })` (or wrap any drawing in `lite(() => …)`) for anything under about 20 px u; it paints washes without the fill passes. flood went from 55 to 4.3 s per frame.
- Large flat areas: `wash`, not `fill`. Use `fill` texture only in a band where the eye is.

## Media choices

- **brush** (default): characters = flat `wash` + ink outline; backgrounds = soft `fill`s. Hundreds of shapes per frame, not thousands.
- **flat**: same code, fills become washes. Use it for every blocking/timing pass (`--medium=flat`); ship it only if the look is wanted or there's no GPU.
- **shader**: `stylize(name, { k, t })` restyles the frame (cave, inkwash, blueprint, halftone, pixel, crt, cel, thermal, stained) — animate `k` to cross into a style. `shade(name, {...})` adds procedural effects (explosion, shockwave, rays, fire). Paint characters after the pass to keep them in front. Give generated shapes an ink edge or the scene palette.
- **lyric bar**: only when the format wants words on screen (`PROJECT.karaoke`); keep faces above y ≈ 960.

## Patterns

```js
// a cut on action: the throw starts in A and lands in B; the prop's world position is shared
const THROW = 4.2, LAND = 4.9, P0 = [700, 640], P1 = [1500, 300];
function shotA(t, lt, dur) { /* … */ if (t > THROW) star(...arcPt(P0, P1, 260, seg(t, THROW, LAND))); /* transition: cut on action */ }
function shotB(t, lt, dur) { /* … */ star(...arcPt(P0, P1, 260, seg(t, THROW, LAND))); }

// a style segment that eases in (one shader per style)
const S0 = 8, S1 = 12;
function remix(t, lt, dur) { scene(t); stylize('inkwash', { t: onTwos(t), k: ease(seg(t, S0, S0 + .4)) - ease(seg(t, S1 - .4, S1)) }); }
```

## Checks while building

- `c2v check <name>` after every shot. 0 errors is mandatory; read every warning (long/short shots, seams, plain p5 shapes, lettering).
- `node render.mjs --project=<name> --medium=flat --sheet=<read times>` for key poses; `--strip=a:b` for each key motion.
- Keep ms/frame in view (`out/render-log.jsonl`): aim ≤ 1.5 s/frame with brush on a GPU.

## Failures and fixes

| symptom | cause | fix |
|---|---|---|
| still things shimmer every frame | a moving element shifts the random stream | `boilSeed('key')` before each separate element |
| a prop floats near the hand | drawn at a guessed position | draw it in the `armR(u, sw)` hook, or compute its point from the same pose; check with a crop |
| outline collapses to a dot when zoomed | p5.brush far-from-origin bug | `paint()`/`inkLine()` already centre shapes; keep long edges as canvas-sized `inkLine`s |
| `OffscreenCanvas … unsigned long` error | NaN in a point list | guard degenerate geometry (`Math.acos` of a ratio > 1, division by 0) |
| face snaps between moods | eyes/mouth swapped by hand | `emotions()` keys |
| second "take" on a cut | the next shot restarts the emotion timeline | start B's keys with A's last key (same time, same mood) |
| a shader effect looks pasted on | no shared edge or palette | ink rim / palette colours (`c1..c3`), paint characters after it |
| selftest fails only at `--scale<1` | upscale resampling at the frame edge | judge determinism at scale 1 |
| a lantern/flower held on the far side of the body | `clawdHand(..., 'near')` in a q/side view | `'lead'` for things held out toward the look |
| one shot renders 4× slower | small Clawds / large `fill`s in watercolour | `c2v cost --skip=…`; `lite` |
| the focal prop is hidden behind Clawd at its read | the character walked in front of it | `reads` R6; put Clawd beside the target |
| a code comment swallowed `]);` or a whole statement | inline comment placed before the closing tokens | put comments at the end of complete statements; `node tests/run.mjs` parses every engine/lib file |

Evidence: `projects/p1-media/scenes/button.js` (brush + explosion shader + flash cut + sound) and the cases in `docs/history/research_log.md`.
