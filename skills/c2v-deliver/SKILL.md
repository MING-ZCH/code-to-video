---
name: c2v-deliver
description: Finish a Code-to-Video project — determinism selftest, final parallel/resumable render with code-generated sound, encode, metrics (optionally against a before-baseline) and the HTML report — and state honestly what was verified where. Use when review passes and the piece is ready to ship, or when someone asks for the MP4 / delivery package / comparison.
---

# c2v-deliver

## Steps

```bash
node bin/c2v.mjs check <name>                 # 0 errors
node bin/c2v.mjs selftest <name>              # shot midpoints, 3 render orders, byte-identical PNGs (scale 1)
node bin/c2v.mjs render <name> --workers=4    # frames → out/frames (resumable: re-run to continue) → synth.wav → video.mp4 → metrics.json
node bin/c2v.mjs report <name>                # out/report.html (video, checks, metrics, storyboard, review frames, render log)
```

- External music: `PROJECT.audio` (or `--audio=`) is muxed by `--encode`; code-generated sound (`sound([...])`) is written to `out/synth.wav` and muxed automatically.
- Interrupted renders: re-run the same `render` command; finished frames are skipped, half-written ones are re-done.
- Where to render: a machine with a GPU (Mac: Chrome + Metal, the default). On a GPU-less Linux box (`scripts/vm-c2v.sh`) watercolour frames cost 5–25 s each; render finals elsewhere, or ship `--medium=flat` and say so.

## Before/after comparisons

`node bin/c2v.mjs metrics <before.mp4> projects/<name>/out/video.mp4` prints both with the same definitions as `docs/baselines.md` (cuts, shot lengths, share in 1.4–4 s, near-still ratio, motion, subtitle share). Put both contact sheets side by side in the report and describe differences you can see, not just numbers.

Caveat on `cuts` / `shot_len_s`: they come from pixel-change spikes. Motion-continuous transitions (whip pans, cuts on action) are missed, and wipes/irises count as two quick changes. For your own renders the code-level shot list (`out/check.json`) is the truth; use the pixel metric only to compare against videos you don't have code for, and say so (umbrella: 4 shots in code, metric found 4 spikes at different places — the iris ends and the two halves of the wipe).

## Delivery package (what to hand over)

- `out/video.mp4` (and `out/synth.wav` if sound is code-generated)
- `out/report.html` with `out/review/*.jpg` next to it
- `STORYBOARD.md`, `scenes/*.js`, `project.js`: the editable source
- `out/check.json`, `out/metrics.json`, `out/render-log.jsonl`: the record

## Report honestly

State, for each claim, how it was checked: built and checked by `c2v check`; looked at in sheets/strips/crops (which); rendered where (GPU or software, scale, medium); what has not been verified yet (e.g. "final brush render on GPU pending", "CJK lyric font not available on this machine"). Never call a frame-check a final acceptance.
