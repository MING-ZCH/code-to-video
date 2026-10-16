# Review: umbrella (c2v-review, 5 passes)

All passes on the GPU-less VM (SwiftShader). Structure/timing passes in `--medium=flat`, look pass in brush at `--scale=0.5`, determinism at scale 1. Images are in this folder.

## Pass 1 — `sheet_1.jpg` (first/mid/last of every shot, flat)
- [x] read: B's umbrella idea does NOT read — the leaf sits at hand height beside the boat. A's boat is too small for the eye to find; Clawd floats above the sidewalk instead of sitting.
- [x] fixes: boat ×1.3 (0.9 → 1.3); A camera 1.0 → 1.15–1.22; seated Clawd's body bottom on the sidewalk; B camera 1.0 → 1.22.

## Pass 2 — `ab_pass2.jpg`, `b_pass3.jpg`, `b_crop.jpg`
- [x] A reads (seated, bored → notices → gasp → jumps up).
- [x] B: canopy centred on the boat but flat; rebuilt as a dome held above the sail, dry patch on the water under it. Crop showed rain falling through the shelter → rain now skips everything under the canopy.

## Pass 3 — `c_pass1.jpg`, `c_pass2.jpg`, `c_pass3.jpg` (the dive, fixed step)
- [x] motion: crouch → smeared arc → catch → splash landing reads.
- [x] continuity: the leaf vanished at the B→C cut → C keeps holding it, lets go on the dive, it flutters into the gutter (same dome design everywhere via `leafDome()`).
- [x] contacts: body floated above the splash ring after landing → seated offset.
- [x] read: splash droplets lined up across the body looked like teeth → droplets start outside the body and are drawn behind it.
- [x] transitions: C's framing (1.25) was almost B's (1.22) → the cut on action read as a jump cut → C at 1.5 → 1.65.

## Pass 4 — `d_pass1.jpg`, `d_pass2.jpg`, `d_pass3.jpg`
- [x] read: butterfly too small (≈40 px) → ×2; payoff too wide → push-in 11.6–13.0.
- [x] timing: hearts popped on top of the landing → love key moved to 12.75 (the landing gets 0.45 s alone); sound moved with it.
- [x] contacts: Clawd floated over its shadow → seated + contact shadow; face hidden by the raised boat → arm lowered.
- [x] a broken edit (comment swallowed `]);`) made the scene fail to load; `c2v check` crashed instead of reporting it → fixed in `lib/check.mjs`, regression test added.

## Pass 5 — `seam_0..4.jpg`, `a_grab.jpg`, `a_grab_strip.jpg`, `look_brush.jpg`
- [x] transitions: iris in ✓, whip pan A→B ✓, cut on action B→C ✓, gold brush wipe C→D ✓, iris out ✓.
- [x] continuity: the leaf popped into existence at A→B → planted on the sidewalk in A, swept into the hand on the jump-up (arc, 0.22 s).
- [x] colour: brush look pass — cold blue-grey rain → warm gold; soaked tint visible; no mud.
- [x] rules: no text; no 3D; no still stretch (`still_ratio` 1.2%).

## Determinism
- [x] `--selftest=1.6,5.1,12.0` at scale 1: three render orders byte-identical.

## Open
- final brush render at scale 1 on a GPU (the VM render is brush at scale 0.5).
- the butterfly covers part of Clawd's face at the landing (accepted: it is the focus of that read).
