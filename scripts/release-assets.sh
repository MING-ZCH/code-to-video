#!/usr/bin/env bash
# Collect the GitHub Release assets into release/<tag>/ (gitignored). Read-only on the projects: files are copied, never moved.
#   bash scripts/release-assets.sh v0.1.0
# Assets:
#   c2v-<project>.mp4        each project's out/video.mp4 (whatever was rendered last: VM scale-0.5 previews unless re-rendered)
#   c2v-input-audio.zip      projects/*/assets/audio.wav (source audio; not in git) → unzip at the repo root to restore
#   c2v-skills.zip           dist/*.skill
#   SHA256SUMS               checksums of all of the above
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="${1:-v0.1.0}"; OUT="release/$TAG"
mkdir -p "$OUT"
n=0
for v in projects/*/out/video.mp4; do
  [ -f "$v" ] || continue
  p=$(basename "$(dirname "$(dirname "$v")")"); case "$p" in _rp*|demo) continue;; esac
  cp "$v" "$OUT/c2v-$p.mp4"; n=$((n + 1))
done
ls projects/*/assets/audio.wav >/dev/null 2>&1 && (rm -f "$OUT/c2v-input-audio.zip"; zip -q -X "$OUT/c2v-input-audio.zip" projects/*/assets/audio.wav)
(rm -f "$OUT/c2v-skills.zip"; cd dist && zip -q -X "../$OUT/c2v-skills.zip" *.skill)
(cd "$OUT" && rm -f SHA256SUMS && (command -v sha256sum >/dev/null && sha256sum ./* || shasum -a 256 ./*) | grep -v SHA256SUMS > SHA256SUMS)
echo "$n videos → $OUT"; ls -la "$OUT"
