#!/usr/bin/env bash
# Final scale-1 renders on the Mac (Chrome + Metal), then the delivery page. Resumable: re-run to continue.
#   cd ~/Desktop/code-to-video && bash scripts/mac-final.sh            (all brush cases)
#   bash scripts/mac-final.sh umbrella whale                           (just some)
set -euo pipefail
cd "$(dirname "$0")/.."
npm install --no-audit --no-fund >/dev/null
PROJECTS=("$@"); [ $# -gt 0 ] || PROJECTS=(umbrella pdoom-c08 upgrade whale night flood keys)
for p in "${PROJECTS[@]}"; do
  echo "=== $p"
  rm -rf "projects/$p/out/frames"                     # the VM frames are scale 0.5 previews: start the finals clean
  node bin/c2v.mjs selftest "$p"
  node bin/c2v.mjs render "$p" --workers=4
  node bin/c2v.mjs report "$p"
done
node bin/c2v.mjs deliver
echo "done: open deliver/index.html"
