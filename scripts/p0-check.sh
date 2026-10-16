#!/usr/bin/env bash
# P0 本地核验（在 Mac 上跑）：环境 → 依赖 → 确定性自检 → contact sheet / strip → 2 s 短片 → 3 个基线 MP4 分析。
# 用法：cd ~/Desktop/code-to-video && bash scripts/p0-check.sh
# 结果全部写入 reports/p0/（日志 + 图片 + JSON），跑完后告诉 Claude 即可，它会读这些文件核验。
set -uo pipefail
cd "$(dirname "$0")/.."
R=reports/p0; mkdir -p "$R/baselines"
LOG="$R/p0-check.log"; : > "$LOG"
say() { echo "$*" | tee -a "$LOG"; }
step() { say ""; say "=== $* ($(date '+%H:%M:%S'))"; }
status() { say "STATUS $1: $2"; }

step "1/6 环境"
say "uname: $(uname -a)"
say "node: $(node -v 2>&1)  npm: $(npm -v 2>&1)"
FF=$(command -v ffmpeg || true); FP=$(command -v ffprobe || true)
say "ffmpeg: ${FF:-未安装}  $( [ -n "$FF" ] && ffmpeg -version 2>&1 | head -1 )"
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] && say "chrome: $CHROME ($("$CHROME" --version 2>/dev/null))" || say "chrome: 未找到（可 export CHROME_PATH=…）"
command -v node >/dev/null && status env ok || { status env "FAIL 缺 node（brew install node）"; exit 1; }
[ -z "$FF" ] && say "提示：缺 ffmpeg 时第 5、6 步跳过（brew install ffmpeg）"

step "2/6 依赖 npm install"
if npm install --no-audit --no-fund >>"$LOG" 2>&1; then status npm ok; else status npm FAIL; exit 1; fi

step "3/6 确定性自检 selftest（同一 t 渲 3 路逐字节比对）"
if node render.mjs --project=demo --selftest=0.3,2.2,4.0,7.5,10.6 2>&1 | tee -a "$LOG" | grep -q 'SELFTEST PASS'; then status selftest ok; else status selftest FAIL; fi

step "4/6 contact sheet + strip + 脸部 crop"
node render.mjs --project=demo --sheet=0.3,1.5,3,4.5,6,7.2,8.6,10.6 --cols=4 --w=480 --out=$R/demo_sheet.jpg 2>&1 | tee -a "$LOG"
node render.mjs --project=demo --strip=6.8:7.4 --cols=5 --w=384 --out=$R/demo_strip.jpg 2>&1 | tee -a "$LOG"
node render.mjs --project=demo --sheet=4.0,8.7 --crop=660,380,600,500 --cols=2 --w=600 --out=$R/demo_crop.jpg 2>&1 | tee -a "$LOG"
[ -s $R/demo_sheet.jpg ] && [ -s $R/demo_strip.jpg ] && status sheets ok || status sheets FAIL

if [ -n "$FF" ]; then
  step "5/6 短片：并行 frames 3.5–5.5 s → encode（测 ms/帧 与续渲）"
  rm -rf projects/demo/out/frames
  node render.mjs --project=demo --frames --range=3.5:5.5 --workers=4 2>&1 | tee -a "$LOG"
  node render.mjs --project=demo --frames --range=3.5:5.5 --workers=4 2>&1 | tee -a "$LOG"   # 第二次应为 0 帧待渲（续渲）
  node render.mjs --project=demo --encode --out=$R/demo_3.5-5.5.mp4 2>&1 | tee -a "$LOG"
  N=$(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 $R/demo_3.5-5.5.mp4 2>/dev/null)
  say "clip frames: $N（期望 48）"; [ "$N" = "48" ] && status clip ok || status clip FAIL

  step "6/6 基线 MP4 分析（时长、镜头切换、contact sheet）"
  echo "[" > $R/baselines/metrics.json; first=1
  for f in *.mp4; do
    b="${f%.mp4}"
    dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
    res=$(ffprobe -v error -select_streams v -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$f")
    cuts=$(ffmpeg -hide_banner -nostats -i "$f" -an -vf "scale=320:-1,select='gt(scene,0.30)',metadata=print" -f null - 2>&1 | grep -c 'pts_time')
    ffmpeg -v error -y -i "$f" -vf "fps=1/6,scale=320:-1,tile=6x7" -frames:v 1 "$R/baselines/$b-sheet.jpg"
    ffmpeg -v error -y -i "$f" -an -vf "scale=320:-1,select='gt(scene,0.30)',scale=320:-1,tile=8x6" -vsync vfr -frames:v 1 "$R/baselines/$b-cuts.jpg"
    say "$b: ${dur}s  $res  cuts(scene>0.30)=$cuts"
    [ $first = 1 ] || echo "," >> $R/baselines/metrics.json; first=0
    printf '{"name":"%s","duration":%s,"stream":"%s","cuts":%s}' "$b" "$dur" "$res" "$cuts" >> $R/baselines/metrics.json
  done
  echo "]" >> $R/baselines/metrics.json
  status baselines ok
else
  status clip "SKIP 缺 ffmpeg"; status baselines "SKIP 缺 ffmpeg"
fi

step "完成"
grep '^STATUS' "$LOG"
say "结果在 $R/ ，回到 Claude 说一声即可。"
