---
name: c2v-orchestrate
description: Run a long Code-to-Video piece (music video, multi-chapter story, > ~30 s) as parallel chapters — one storyboard, one world, strict file boundaries, agreed seams and shared cast — and brief subagents so each builds and reviews its own chapter file. Use when a piece is too long for one pass or when several agents will work on it at once (the PDoomVideo pattern).
---

# c2v-orchestrate

PDoomVideo (156.6 s, nine chapters) was built this way: one storyboard, one style guide, one subagent per chapter file. This skill packages that pattern.

## 1. Plan (you, before any agent starts)

- Write the whole `STORYBOARD.md` (c2v-storyboard), split into chapters at musical sections (`c2v ingest` gives loudness sections; cut on bar lines) or story acts. Each chapter: time range, setting, palette, the shots with reads.
- Write the **world note** at the top: palette per chapter and the colour arc, the cast and their sizes, recurring props, the motif and where it pays off.
- Write the **seam table**: for every chapter boundary, the transition, its colours and who owns which half (the earlier chapter owns the OUT, the later the IN).
- Shared cast or props used by more than one chapter go in `scenes/00_cast.js`, written first and loaded first in `PROJECT.scenes`.

## 2. File boundaries

| file | owner |
|---|---|
| `STORYBOARD.md`, `project.js`, `scenes/00_cast.js` | orchestrator |
| `scenes/NN_<chapter>.js` | exactly one chapter agent |
| `engine/`, `render.mjs`, `bin/`, `lib/` | nobody (read-only); bugs are reported with a frame and a crop |

Each chapter file is an IIFE that calls `shots([...])` with **absolute** times inside its range; the engine merges and sorts them.

## 3. Brief for each chapter agent (copy and fill)

```
You are building chapter <NN> "<title>", <t0>–<t1> s, of projects/<name>. Read ANIMATION_GUIDE.md (both parts), then
STORYBOARD.md (the whole thing, then your chapter closely), then scenes/00_cast.js.
Only edit scenes/<NN>_<title>.js. Private helpers go inside your IIFE. Don't edit any other file; if you find a bug in a
shared file, stop and report it with the frame time, a crop and what you expected.
Your seams: IN at <t0> = <transition, colours> (the previous chapter ends with <…>); OUT at <t1> = <transition, colours>.
Use absolute times. Tie every sound event to the same constant as its picture.
Loop: build a shot → `node bin/c2v.mjs check <name>` (0 errors in your file) → flat sheet at the read times → strips for
key motions → crops for faces and contacts → fix → next shot. Render only your time range.
Report: what each shot does, what you looked at (image paths), what you fixed, ms/frame, open issues.
```

## 4. Integrate

- `c2v check` on the whole project; `c2v seams` and look at every chapter boundary yourself.
- A fixed-step flat sheet across the whole piece: is it one world, does the colour arc read, does the motif pay off?
- Then c2v-review on the joins and c2v-deliver.

## Failures and fixes

| symptom | fix |
|---|---|
| each chapter looks like a different film | tighten the world note (palette, line weight, character size) and re-brief; share props via `00_cast.js` |
| two agents edited the same shared helper | revert; move the helper into one chapter's IIFE or into `00_cast.js` (orchestrator-owned) |
| a seam doesn't match (colours, direction, motion) | the seam table is the contract; fix whichever side broke it |
| chapters drift from the beat | `PROJECT.bpm/offset` come from `c2v ingest`; hits use `beatN()`/`pulse()` and absolute times |
