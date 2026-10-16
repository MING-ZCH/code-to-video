#!/usr/bin/env bash
# render.mjs on a GPU-less Linux box: software WebGL (SwiftShader) + the locally unpacked libXdamage.
#   scripts/vm-render.sh --project=demo --sheet=1,2,3
set -euo pipefail
TOOLS="${C2V_TOOLS:-$HOME/tools}"
LIB=$(dirname "$(find "$TOOLS/libs/root" -name 'libXdamage.so.1' 2>/dev/null | head -1)" 2>/dev/null || true)
export LD_LIBRARY_PATH="${LIB:+$LIB:}${LD_LIBRARY_PATH:-}"
cd "$(dirname "$0")/.."
exec node render.mjs --soft-gl "$@"
