#!/usr/bin/env bash
# bin/c2v.mjs on a GPU-less Linux box (software WebGL + local libXdamage). Same arguments as c2v.
set -euo pipefail
TOOLS="${C2V_TOOLS:-$HOME/tools}"
LIB=$(dirname "$(find "$TOOLS/libs/root" -name 'libXdamage.so.1' 2>/dev/null | head -1)" 2>/dev/null || true)
export LD_LIBRARY_PATH="${LIB:+$LIB:}${LD_LIBRARY_PATH:-}"
exec node "$(dirname "$0")/../bin/c2v.mjs" "$@" --soft-gl
