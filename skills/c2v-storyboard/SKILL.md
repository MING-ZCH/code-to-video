---
name: c2v-storyboard
description: Write the STORYBOARD.md for a Code-to-Video project — logline, world, motif, emotional arc, and a shot list where every shot has one EVENT, timed viewer "reads", a camera and a transition at every seam. Use after `c2v new/ingest` and before writing any scene code, or when a cut is muddled and needs re-planning.
---

# c2v-storyboard

The storyboard is the timing sheet. Most failures in generated animation are planning failures: nothing happens, everything happens at once, or it's over before anyone understands it. Fix them here, where they are cheap.

## Inputs

- `projects/<name>/input/brief.md` (from `c2v ingest`): timed lines, beats, palette, tempo, source shots.
- ANIMATION_GUIDE.md rules 3 (something happens), 4 (timing: model the viewer), 6 (transitions always), 7 (one piece). Read them again now.

## Procedure

1. **Logline** in one sentence: *X wants ___, but ___, so ___.* If you can't write it, you don't have a film yet.
2. **World**: one setting, a palette of 4–6 colours (an image input gives you its palette), the light, and a colour arc across the piece (e.g. cold dawn → warm noon).
3. **Motif** that recurs and pays off; plan where it pays off. **Arc**: the emotion keys across the whole piece, not per shot.
4. **Shots.** For each: start–end, transition in, what's seen, the EVENT, the reaction, the camera. Then the **reads**: what the viewer must understand, in order, each with a start–end.
   - Each read needs time to be found, understood and registered. Big/central/obvious: ~0.4–0.6 s. Small/distant/subtle: 0.8–1.2 s. The last read of the piece needs time before the end.
   - One read at a time. A cause and its reaction go in sequence, never on top of each other.
   - Shot length = what its reads need. Typical 1.4–4 s. Longer only if the reads keep changing.
5. **Transitions**: name one for every seam, including into the first shot and out of the last. Pick ones that belong to the story (a blast's flash, a door closing as an iris, a whip pan following a throw, a match cut on a shape). Vary them.
6. **Music**: put hits and cuts on beats (`PROJECT.bpm/offset`); big changes on bar lines; one visual idea per musical phrase. Lyrics are acted, not written.
7. **Sound** (if the piece has code-generated sound): list each sound event next to the visual event it belongs to.

## Format

```
Logline: …
World: …
Motif: …
Arc: …
Shots:
  A  0.00–2.50  [transition in: iris open]  what's seen · the EVENT · the reaction · camera
     reads:  0.00–0.45  first thing to understand
             0.45–1.00  next (where is the eye when it starts?)
  B  2.50–6.00  [transition: flash cut — …]  …
     reads:  …
  [transition out: …]
```

`c2v check` counts lines like `A  0.00–2.50` and `reads:` — keep the format.

## Three tables that prevent the most common misses (RSI round 1)

Across the first six pieces, 77% of what review caught was one of: the focal thing too small or out of frame at its read, a prop popping in/out across a cut, a jump cut, a hand not touching a prop, a character floating. Plan them away here:

- **Read targets.** For every read, name its focal element in the read's words ("the butterfly flutters in", "the last star"), and its minimum on-screen size: ≥ 70 px (about 6.5% of frame height) for a prop, a face that must act ≥ 150 px. Make sure it's on screen for the whole read window, not just its end. `c2v reads` checks this from the scene's `focus()` declarations and matches them by these words.
- **Props table.** Every prop that a character carries: where it's planted (shown before it's needed), which seams it crosses, how it leaves. A carried prop can't appear at a cut without a set-up, not even after a whip pan.
- **Framing table.** Each shot's zoom and centre. A cut on action needs the framing to change clearly (≥ 20% in zoom or ≥ 15% of the frame in centre) or it reads as a jump cut. Mediums keep both the subject and what it reacts to in frame.

## Self-check before building

- [ ] An event in every shot (something different in the last frame vs the first)?
- [ ] Every read has its own time; no two important reads overlap?
- [ ] A transition at every seam, not all the same kind?
- [ ] Any text anywhere (signs, labels, captions, title cards)? Remove it; act it instead.
- [ ] Does the ending rhyme with the opening (same place / pose / motif, changed)?
- [ ] Character big enough to act (medium shots u 20–28, close-ups 40–70)?
- [ ] Is there a single world, or does every shot invent a new one?

## Failures and fixes

| symptom | fix |
|---|---|
| a shot is "Clawd in a place, being cute" | give it a want and an obstacle; the event is the attempt |
| 5 reads in 2 s | lengthen the shot or cut reads; never squeeze |
| a shot over 6 s with one read | split it, or add a development (complication, reaction, payoff) |
| a lyric line explained by a sign | act the line: a gesture, a prop interaction, a transformation |
| a transition chosen for variety only | motivate it by the story: the action of shot A carries into shot B |

Evidence this works: `projects/p1-media/STORYBOARD.md` (6 s, two shots, flash cut) and the case studies listed in `research_log.md`.
