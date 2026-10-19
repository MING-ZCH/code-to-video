# RSI round 1: turn review catches into tools, then re-test on 3 new cases

Branch `rsi/round-1`. Source: the 39 problems that visual review caught across the 6 finished pieces (`deliver/index.html`, `docs/case-*.md`, review notes). Every one of them passed `c2v check` with 0 errors first; all were caught only by eye.

## 1. What the 39 catches have in common

| class | count | examples | automatable? |
|---|---|---|---|
| R1 the focal thing is too small at its read | 8 | butterfly ≈40 px, mug, phone, the touched star, tap sparks too big (the reverse), boat ×0.9 | **yes**: scene declares its focal elements; tool measures their screen size at read times |
| R2 the focal thing is out of / cut by the frame | 5 | blast cropped in mediums, last star out of frame, gauge behind a curtain, roof leaving frame in 0.15 s, last read too wide | **yes**: same declarations; in-frame test |
| R3 continuity across a seam | 6 | leaf pops in / vanishes, Clawd's position jumps E→F, emote re-take on a cut | **yes, partly**: compare declared elements and emotion timelines across each seam |
| R4 jump cut | 2 | cut on action between 1.22 and 1.25 zoom | **yes**: compare camera before/after each continuous seam |
| R5 contact / reach | 5 | button behind body, pump handle out of reach, lever, leaf stem, props on the hidden arm | **engine helper**: `clawdHand()` gives the exact hand point for any view/flip/pose; three scenes hand-rolled it |
| R6 sitting / floating | 4 | Clawd floats over the splash, over its shadow, on the curb, on the bench | **engine helper**: `sit: true` |
| R7 timing / causality | 4 | reaction on top of cause, hat flies before the wave, stroke 0.18 beat late | guidance + constants (not reliably automatable) |
| R8 style destroys detail | 2 | stained glass cells, sip unreadable | guidance + R1 with a style-aware minimum |
| R9 tooling | 3 | check crash, encode ignored song, CJK font | already fixed + tested |

R1–R6 are 30 of the 39 (77%).

## 2. Changes

1. **Engine:**
   - `focus(id, x, y, w, h, o)` declares a focal element in world space; it's recorded with its screen box each frame. No visual effect.
   - `clawdHand(x, y, u, o, which)` returns the world point of a hand, using the same geometry as `clawd()`.
   - `clawd(..., { sit: true })` seats the body on the ground point (no legs, contact shadow).
   - `emotions()` logs its key timeline for the seam check.
2. **`c2v reads <name>`** samples every shot (start, read times from STORYBOARD, end) in flat medium and checks:
   - **R1:** declared elements are at least `minPx` (default 70 px, about 6.5% of the frame height) on screen.
   - **R2:** they are inside the frame.
   - **R3:** across each continuous seam (cut on action, whip, camera move), an element doesn't pop in or vanish, and no `emotions()` timeline restarts with a take at the cut.
   - **R4:** a continuous seam changes the framing by at least 25% in zoom, or moves the centre by at least 15% of the frame.
3. **Skills:** read-size budget, prop lifetime table and per-shot framing in c2v-storyboard; `focus` / `clawdHand` / `sit` in c2v-build; `c2v reads` before eyes in c2v-review.
4. **MCP server** `mcp/c2v-mcp.mjs` (stdio JSON-RPC): exposes new / ingest / check / reads / sheet / strip / selftest / metrics / render as tools, so an agent calls them directly and gets images back.
5. **Failure replay suite** `tests/replay.mjs`: re-introduces historical failures into copies of the finished projects and asserts that the new checks flag each one. This is the before/after evidence for the tools themselves.

## 3. Validation

- **Replay suite:** each replayed historical failure must be flagged. The clean projects must produce no R1–R4 warnings, or only explained ones.
- **3 new cases**, different input kinds (lyrics + audio from a baseline, a key image, a new text script), built with the new tools. Measure:
  - problems caught by `c2v reads` before any eye pass;
  - problems still caught only by eye;
  - review passes and fixes per piece.

  The previous round averaged 6.5 fixes and 3.7 passes per piece, all caught by eye.
- Same VM, same renderer; brush at scale 0.5 as before.

## 4. Results (2026-10-16, VM, brush scale 0.5)

### 4.1 Replays and false positives

- `tests/replay.mjs`: **7/7 caught**. These are the 6 round-0 failures plus R6, which keys added (the drawer behind Clawd).
- `c2v reads` on the 8 finished projects: 0 warnings after the refinements below. pdoom-c08 and whale have no declarations, so they report R0 info only.
- False positives found on the way, and the fix for each:

| rule | where | fix |
|---|---|---|
| R1/R2 | everywhere | only at read mid-samples, and only for elements the read is about (id / `words`) |
| R3 | whip pans | only same-space seams; whip pans excluded |
| R4 | match cuts | only cut on action; identical framing exempt |
| R6 | flood "huddle" group | a character inside a group target (≥ 60% of its box) counts as part of it |
| R6 | the "Clawd panicking" read | no longer exempts Clawd from hiding the cabinet |

### 4.2 The 3 new cases

| case | input | length / shots | caught by tools before the eye | caught only by eye | eye passes | fixes |
|---|---|---|---|---|---|---|
| night | lyrics + audio (deepseek baseline 85.8–99.5 s) | 13.7 s / 4 | 2: 1 real (a missing declaration), 1 rule false positive (fixed) | 4 | 2 | 5 |
| flood | one key image (gpt-6 baseline at 121 s) | 10 s / 3 | 1: `cost` found shot C 3.9× slower; `reads` clean on first run | 4: lantern on the trailing arm → `'lead'` hand; faint gold path; sun hidden behind cloud; faint gust lines | 2 | 5 |
| keys | Chinese text script | 14 s / 4 | 1: R1 the cat 110 px during the iris read | 3: drawer and shoe cabinet hidden behind Clawd → **R6 added**; set edge visible at x > 3400; the cut on action had no action before the cut | 3 sheets | 4 |
| **round 1 mean** | | | **1.3** | **3.7** | **2.3** | **4.7** |
| round 0 mean (6 pieces) | | | 0 | 6.5 | 3.7 | 6.5 |

Other evidence:

- Every case passed selftest (byte-identical PNGs) after the glow fix.
- Before/after metrics against the baseline:
  - night: near-still 52.4% → 15.9%, motion 2.99 → 6.91.
  - flood: near-still 0%, motion 9.29.
  - keys: see `reports/rsi1/keys/`.

### 4.3 What changed in the tools this round

| change | triggered by | evidence |
|---|---|---|
| `focus` / `reads` R1–R4 + replay suite | round-0 catch analysis | 6/6 replays |
| procedural-shader `glow()` | night selftest failed: textured additive quads varied under SwiftShader | 60-glow fixture byte-stable; 0.05/255 mean difference vs the old glow |
| `clawdHand(..., 'lead')` | flood: lantern held on the far side | — |
| `clawd({ lite })`, `lite()`, `skipped()`, `c2v cost` (R5) + MCP `c2v_cost` | flood 55 s/frame; skip-profiling found the 3 small Clawds cost ≈12 s | 4.3 s/frame after |
| R6 occlusion (`focusClawd` boxes opaque, `{ front }`) | keys sheet 1 | 7th replay |

### 4.4 Honest caveats

- Three cases is a small sample. Round-1 cases are also shorter (10–14 s vs 9–24 s) and simpler, so the drop in fixes is partly the cases, not only the tools.
- The same agent wrote the rules and the cases. The cases weren't blind: I knew the rule set while storyboarding, which probably prevented some R1/R2 problems before any tool ran. That is the intended effect, but it isn't a measured tool catch.
- Eye catches are still the majority (11 of 15). The recurring eye-only classes are contrast/salience, wrong hand, missing action across a cut, and set edges. Of these, only set edges looks automatable next: a check for frame pixels outside every painted background.
- The pixel cut detector counts flashes and irises as cuts (flood: 4 "cuts" for 3 shots) and misses cuts on action. Shot lengths for our own pieces come from `check.json`.
- Not done here: a scale-1 GPU final on the Mac.
