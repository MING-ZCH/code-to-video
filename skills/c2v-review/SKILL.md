---
name: c2v-review
description: Visually verify a Code-to-Video project by rendering and actually looking at contact sheets, frame strips and crops — read, timing, motion, boil, contacts, transitions, rules and colour for every shot — then fix and look again. Use after building shots, after any change to a shot, and before a final render.
---

# c2v-review

You can't see motion by reading code. This step is where most quality comes from: budget for several passes.

## Step 0: let the machine catch what it can

```bash
node bin/c2v.mjs check <name>     # rules, seams, determinism hazards
node bin/c2v.mjs reads <name>     # R1 too small · R2 out of frame · R3 held props / emotion re-takes at cuts · R4 jump cuts · R6 hidden behind a character
node bin/c2v.mjs cost <name> --scale=.5   # R5 one shot far slower than the rest; --skip=part,… to find what costs
```

Fix or explain every `reads` warning before spending eyes on frames. In round 1, this caught 6 of 6 replayed historical failures with no false positives on the six finished pieces. It also found one problem the eye had missed: umbrella's boat was off screen for 70% of its "drifting in" read.

What `reads` cannot see (still the eye's job, from the 3 round-1 cases): contrast and salience (a gold path too faint on dark water, a sun hidden behind a cloud), a prop held in the wrong hand, a declared box larger than the drawing, and whether an action reads as the intended *verb*. When the eye finds something a box test could have caught, add a rule and a replay (`tests/replay.mjs`), as R6 was added after keys.

## One pass

```bash
node bin/c2v.mjs review <name> --medium=flat          # check + per-shot sheet (first/mid/last) + a strip at every seam + REVIEW.md
node render.mjs --project=<name> --medium=flat --sheet=<every 0.1–0.15 s of a shot> --cols=6 --w=320   # timing read
node render.mjs --project=<name> --strip=<a:b> --cols=6 --w=320                                        # a key motion, every frame
node render.mjs --project=<name> --sheet=<t1,t2> --crop=x,y,w,h --w=600                                # faces, hands, contacts
node render.mjs --project=<name> --strip=<a:b> --crop-at=<worldX,worldY,w,h>                           # a foot/prop on a moving camera
```

Use `--medium=flat` for structure and timing passes (≈10× cheaper), brush (optionally `--scale=0.5`) for the look pass and crops. Open every image and look at it.

## What to check (fill `out/review/REVIEW.md`)

1. **Read**: from the sheet alone, is each shot's event clear? Is the character big enough and separate from the background?
2. **Timing**: read a fixed-step sheet like a viewer. At each frame: where is the eye, and do they understand yet? Count frames per read (24 = 1 s). A read that flashes by in a few frames, or shares frames with another read, is missed.
3. **Motion** (strips): anticipation and follow-through on every move; no pops or snaps; parts move at different times; nothing at constant speed; no mirrored/twinned limbs; poses pushed far enough.
4. **Boil**: paired frames that share a boil drawing match except where something moves.
5. **Contacts** (crops): feet on the ground, held things touching the hand, thrown things leaving from the hand.
6. **Transitions**: first and last 0.5 s of every shot and every seam (the seam strips).
7. **Rules**: any text, any 3D, any dead stretch?
8. **Colour**: mud from yellow-over-blue (use `glow()`), pure black/white, a shader layer that doesn't belong.

Write what you found and what you changed under each shot. Re-run `c2v review` after fixes.

## Reading the numbers

- `c2v check` warnings: shots < 1 s or > 6 s, seams without transitions, lettering calls, plain p5 shapes.
- `c2v metrics` on a render: `shots_1p4_4s` (share of shots in the storyboard rule's window), `still_ratio` (near-still 1/12 s steps; aim ≈ 0), `bottom_band_text` (lyric bar / subtitles). The before-baselines (`docs/baselines.md`) had 16–46% near-still and median shots of 4–13 s.

## Failures this step has caught (worked examples)

| seen | where | fix |
|---|---|---|
| the hand never touches the button; the body hides it | press crop, `projects/p1-media` | move the prop, resize it, re-check with a crop |
| a seam called "cut on action" was a hard cut with a screen-direction jump | seam strip at 2.5 s | flash cut motivated by the blast; same emotion key on both sides |
| the emote popped twice across a cut | same strip | shot B starts its `emotions()` with shot A's last key |
| the explosion looked flat grey and pasted on | fixed-step sheet | inner fire under the cap, ink rim on the cloud |
| the key idea (a leaf held as an umbrella) didn't read: flat leaf at hand height beside the boat | first-pass sheet, `projects/umbrella` | dome shape centred above the boat, dry patch under it; crop showed rain falling through it → shelter the rain |
| a prop vanished at a cut, another popped in at the next | seam strips | plant the prop in the earlier shot; carry it across; let it go on an arc |
| a cut on action between two near-identical framings read as a jump cut | seam strip B→C | change the framing clearly (1.22 → 1.5 zoom) |
| the reaction (hearts) landed on top of its cause (the butterfly landing) | fixed-step sheet of the last shot | delay the reaction key ~0.45 s; move the sound with it |
| splash droplets in a row across the body looked like teeth | landing crop | spawn droplets outside the body, draw them behind |

## Exit criteria

- Every shot: sheet looked at; every key motion and seam: strip looked at; every story-carrying face: crop looked at.
- `REVIEW.md` boxes filled with notes, or a written reason why a box doesn't apply.
- `c2v check`: 0 errors, every remaining warning explained.
