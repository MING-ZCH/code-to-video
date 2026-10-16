# Case C: before → after on the same input (decision ③)

**Before:** `gpt-6-one-more-upgrade.mp4`, 32–50 s (the chorus), from Leo's earlier attempts.
**After:** `projects/upgrade/`, built with the c2v pipeline from **the same audio** (sliced from the baseline) and **the same four lyric lines** (transcribed from its burned-in subtitles; times from its subtitle band).
**Evidence:** `reports/p4/caseC/compare.jpg` (top two rows before, bottom two after, same times), `reports/p4/caseC/metrics.jsonl`, review images.

## Same-definition metrics (`c2v metrics`, identical code for both)

| metric | before | after | note |
|---|---|---|---|
| near-still share (1/12 s steps) | **20.5%** | **0.9%** | the guide's "nothing is ever still" |
| motion (mean abs diff) | 2.33 | 5.35 | 2.3× livelier |
| pixel-detected cuts / median shot | 1 / 9.0 s | 2 / 4.25 s | the pixel detector misses whip pans and cuts on action (see c2v-deliver); in code the after has 4 shots of 4.3–4.7 s, one per lyric line |
| lyric bar share | 88.9% | 88.9% | both are MVs with a bilingual lyric bar (kept on purpose for a fair comparison) |
| lettering in the picture | many labels (TEXT, IMAGE, CODE, DESK: GPT, 04 / ONE MORE UPGRADE, WHY?, RISK, the ONE MORE UPGRADE title) | 0 lettering calls (`c2v check`) | rule 2 |

## What changed, by eye (`compare.jpg`)

- **Before:** two small characters stand on a stage while elements fade in. A title card and signs carry the meaning. Each line plays over one long, mostly static framing.
- **After:** every line has one acted event:
  - two zaps grow Clawd until it bonks the lamp ("one more upgrade, one more try");
  - its head pushes the roof off and it touches a star ("raise the ceiling, touch the sky");
  - it throws a lever and conducts spotlights on the beat ("I hold the switch, I run the show");
  - the lights go out one by one and it shrinks back to its first size under the last star ("at least I did a song ago").

  The ending rhymes with the opening (small Clawd on the pad), and the character is big enough to act with its face.
- **What the before does better:** a denser, more designed set (screens, desks, a gauge prop) and a recognisable world borrowed from the rest of that video. The after's room is plain: one pad, one lamp, a console.

## Review (4 passes, 7 fixes)

- The growth read as shrinking: the camera pulled back continuously. Fix: hold, then pull back with the second zap.
- The bonk didn't read: the lamp hid behind the body and the head never reached it. Fix: lamp centred and in front, sized to the head.
- The roof was dark on a dark sky; then it left the frame in 0.15 s; then the head overlapped it instead of lifting it. Fixes: lighter planks; a two-phase lift (riding on the head, then flung); a wider framing for B; the roof drawn after Clawd.
- The touched star was too small. Fix: enlarged.
- The last star was out of frame after the push-in. Fix: re-framed.
- Line 1 of the lyric bar was 2.4 s early. Cause: the subtitle-band change at 32.2 s belonged to the previous line. Fix: the previous line is added and line 1 starts at 2.6 s; only the affected 118 frames were re-rendered.
- The VM had no CJK font: the second lyric line rendered as boxes. Fix: WenQuanYi Micro Hei added to `vm-setup.sh` and the lyric bar's font list.

## Status

- Built ✅ · reviewed ✅ · deterministic ✅ (selftest at scale 1) · rendered at brush scale 0.5 with the original audio ✅.
- Shot lengths are 4.3–4.7 s, set by the lyric lines (3–4 reads each). They're above the 1.4–4 s guideline but below the 6 s warning: a conscious choice, recorded here.
- Pending: a scale 1 GPU render on the Mac; a longer stretch of the same song (the whole video would be the full before/after).
