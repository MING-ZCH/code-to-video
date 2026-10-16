#!/usr/bin/env bash
# One-time setup for a GPU-less Linux box (e.g. the aarch64 Claude VM): headless Chromium + the one missing X lib.
set -euo pipefail
TOOLS="${C2V_TOOLS:-$HOME/tools}"; mkdir -p "$TOOLS/libs"
npx -y playwright-core install chromium-headless-shell
SHELL_BIN=$(find "$HOME/.cache/ms-playwright" -name chrome-headless-shell -type f | sort | tail -1)
if ldd "$SHELL_BIN" | grep -q 'libXdamage.so.1 => not found'; then
  (cd "$TOOLS/libs" && apt-get download libxdamage1 && dpkg -x libxdamage1_*.deb root)
fi
echo "chrome: $SHELL_BIN"
# a CJK font for bilingual lyric bars (the VM has none; Macs have PingFang)
if ! fc-list | grep -qi wqy; then
  (cd "$TOOLS/libs" && apt-get download fonts-wqy-microhei && dpkg -x fonts-wqy-microhei_*.deb root)
  mkdir -p "$HOME/.fonts" && cp "$(find "$TOOLS/libs/root" -name 'wqy-microhei.ttc' | head -1)" "$HOME/.fonts/" && fc-cache -f "$HOME/.fonts"
fi
