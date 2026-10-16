# Case A: PDoomVideo chorus 4, regenerated with the c2v skills

**Input:** the 17 s audio slice (song 123.5–140.5 s) and its six lyric lines, from `projects/pdoom-c08/input/`.
**Output:** `projects/pdoom-c08/` (STORYBOARD.md, scenes/main.js), `out/video.mp4`.
**Comparison:** `reports/p4/caseA/compare.jpg`. The top two rows are the original chapter rendered from its own repository; the bottom two are ours, at the same song times.

## Process (c2v skills)

- **Ingest.** The tempo came out at 87.8 BPM with high confidence. The first-beat phase from the 17 s excerpt was 0.305 s; the full song gives 0.094 s inside this slice. This is the excerpt limitation the brief warns about, so `bpm`/`offset` were set by hand to 88 / 0.094 (as the skill instructs).
- **Storyboard.** 6 shots with a read timeline, one event per lyric line, and a transition at every seam: red flash, whip pan, a match cut from the warp grid to the tile grid (with a halftone "memory" style fading in), iris, whip pan, and a camera pull-back that carries straight out of E.
- **Check.** 0 errors, 0 warnings.
- **Review.** 4 passes found 9 problems, all fixed:
  - The recursion zoom-out ended too wide, so the last read failed.
  - The tap sparks were oversized.
  - Continuity: Clawd's position jumped between E and F.
  - After the curtains closed, they hid Clawd's bow.
  - The stage props were behind the curtains throughout the reveal.
  - The curtains left a gap where they met.
  - The bow read as a sideways lean.
  - The pump handle was out of the hand's reach.
  - The pump stroke landed 0.18 beat late.
- **Render.** Selftest passed at scale 1 (3 times). Render was watercolor at 0.5 scale, 408 frames, 3 workers, about 5 s/frame on the VM, plus the song slice.

## Comparison (same song times)

| | original (PDoomVideo c08) | ours (pdoom-c08) |
|---|---|---|
| shots in 123.5–140.5 s | 7 (code) | 6 (code) |
| scene code | 841 lines (plus the shared cast/props files) | 213 lines (engine only) |
| static rule check | 0 error, 0 warn; 1 lettering call ("SLAM!") | 0 error, 0 warn; 0 lettering calls |
| characters | Clawd and the Researcher, plus troupe | Clawd only (×3 in the recursion shot) |
| lyric bar | on | on |
| near-still ratio | not measured (no original MP4 in the VM) | 0.5% |

What you can see in `compare.jpg`:

- **The original is richer in every frame.** It has two acting characters, more props per shot, a sunburst backdrop, and more colour variety. Its gags are wittier: Clawd in a bandit mask at a school desk for "masked pre-training", the Researcher's dizzy and scared reactions, and a costume reveal with three small Clawds at the end.
- **Ours carries the same structural virtues with less density.** Every lyric line has one readable event, every seam has a motivated transition, and the reads are single and sequential. The world is one stage set throughout, and the final reveal pays off the props.
- **Ours is weaker in the places you'd expect:** sparse backgrounds, a single character with no counterpart to react to, and props built from few shapes. The gap is mostly a matter of detail and cast.

## Caveat: not a blind test

Before planning I had read the Feishu doc's one-line summary of this chapter (red alarm, the Loom, a masked-pretraining flashback, recursive self-upgrade, Ilya's door, the "all for show" reversal) and the opening of PDoomVideo's STORYBOARD (the stage-show framing with the pull-back twist). Ours shares the loom, the door of light and the stage reveal. Some of that may come from what I had read rather than from the lyrics alone. A clean test needs a chapter whose plan hasn't been seen, ideally run by a fresh agent with only the skills and the inputs.

## Status

- Built ✅ · visually reviewed ✅ (4 passes, images in `reports/p4/caseA/`) · deterministic ✅ · rendered at 0.5 scale ✅.
- Pending: a full-scale GPU render on the Mac (`node bin/c2v.mjs render pdoom-c08 --workers=4`), and a blind rerun on another chapter.
