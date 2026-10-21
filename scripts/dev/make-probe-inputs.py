#!/usr/bin/env python3
"""Synthetic test inputs for the image-input probe (projects/probe-img). No generative models: matplotlib + PIL only.

  poster.pdf / poster.png   a 3-column academic poster (title band, method diagram, bar chart, text blocks)
  richtext.png              a Chinese rich-text card (heading, highlighted lines, bullets, a quote box)
  meme.png                  a two-caption meme on a real key frame (projects/flood/input/bridge.png)

usage: python3 scripts/dev/make-probe-inputs.py <out_dir>
"""
import sys, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
from matplotlib import font_manager
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
CJK = next((f for f in font_manager.findSystemFonts() if "wqy-microhei" in f.lower() or "pingfang" in f.lower() or "notosanscjk" in f.lower()), None)

# ---------- poster (A0-ish landscape ratio 16:10, rendered at 2400x1500) ----------
fig = plt.figure(figsize=(16, 10), dpi=150); ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 160); ax.set_ylim(0, 100); ax.axis("off")
ax.add_patch(Rectangle((0, 86), 160, 14, color="#1f3b6f"))
ax.text(80, 94.5, "PixelFree: Turning Posters into Videos with Programs", ha="center", va="center", fontsize=30, color="white", weight="bold")
ax.text(80, 89, "A. Author, B. Author   ·   Example University   ·   Probe input for code-to-video", ha="center", va="center", fontsize=14, color="#dfe7f5")
cols = [(4, "1. Motivation"), (57, "2. Method"), (110, "3. Results")]
for x, h in cols:
    ax.add_patch(FancyBboxPatch((x, 6), 46, 76, boxstyle="round,pad=0.6", fc="#f4f6fa", ec="#9aa7bd", lw=1.5))
    ax.text(x + 2, 78, h, fontsize=20, weight="bold", color="#1f3b6f", va="center")
body = ["Video models give pixels;", "programs give editable,", "diffable, reproducible", "frames. We parse the poster", "layout, then animate each", "panel in reading order."]
for i, s in enumerate(body): ax.text(6, 70 - i * 5.2, s, fontsize=15, va="center")
ax.text(6, 34, "Key idea", fontsize=16, weight="bold", color="#b4472b")
ax.add_patch(FancyBboxPatch((6, 14), 42, 16, boxstyle="round,pad=0.5", fc="#fff3e6", ec="#b4472b", lw=1.5))
ax.text(27, 22, "frame(t) = f(t), no model", ha="center", va="center", fontsize=17, family="monospace")
# method diagram: 3 boxes with arrows
for j, (lab, c) in enumerate([("Parse", "#4c78a8"), ("Plan", "#f58518"), ("Render", "#54a24b")]):
    y = 66 - j * 20
    ax.add_patch(FancyBboxPatch((66, y - 5), 28, 10, boxstyle="round,pad=0.6", fc=c, ec="none"))
    ax.text(80, y, lab, ha="center", va="center", fontsize=20, color="white", weight="bold")
    if j < 2: ax.add_patch(FancyArrowPatch((80, y - 6.5), (80, y - 13.5), arrowstyle="-|>", mutation_scale=30, lw=2.5, color="#333"))
ax.text(80, 12, "layout → storyboard → frames", ha="center", fontsize=14, style="italic", color="#444")
# results bar chart (inset axes)
bx = fig.add_axes([0.72, 0.30, 0.25, 0.40]); vals = [41.2, 55.8, 73.4]; names = ["slides", "video gen", "ours"]
bx.bar(names, vals, color=["#9aa7bd", "#9aa7bd", "#54a24b"]); bx.set_ylim(0, 85); bx.set_ylabel("PaperQuiz acc. (%)", fontsize=12)
for i, v in enumerate(vals): bx.text(i, v + 2, f"{v}", ha="center", fontsize=13, weight="bold")
bx.spines[["top", "right"]].set_visible(False); bx.set_facecolor("#f4f6fa")
ax.text(112, 20, "Ours +17.6 over the best baseline", fontsize=14, va="center")
ax.text(112, 14, "(synthetic numbers for the probe)", fontsize=12, va="center", color="#777")
fig.savefig(f"{out}/poster.pdf"); fig.savefig(f"{out}/poster.png"); plt.close(fig)

# ---------- rich-text card (1080x1440, 3:4) ----------
W, H = 1080, 1440
im = Image.new("RGB", (W, H), "#fffaf2"); d = ImageDraw.Draw(im)
F = lambda s: ImageFont.truetype(CJK, s)
d.rectangle([0, 0, W, 180], fill="#ff6b4a"); d.text((60, 55), "3 个让视频不再像PPT的小技巧", font=F(58), fill="white")
y = 240
lines = [("① 每个镜头只讲一件事", "#222", None), ("   观众需要 1.5–4 秒读懂它", "#666", None),
         ("② 用动作代替文字", "#222", "#ffe08a"), ("   把“说明”变成角色的表演", "#666", None),
         ("③ 切点前要有动作", "#222", None), ("   没有动作的切点会显得生硬", "#666", None)]
for s, c, hl in lines:
    f = F(52 if c == "#222" else 40); bb = d.textbbox((70, y), s, font=f)
    if hl: d.rectangle([bb[0] - 8, bb[1] - 6, bb[2] + 8, bb[3] + 8], fill=hl)
    d.text((70, y), s, font=f, fill=c); y = bb[3] + (34 if c == "#666" else 22)
d.rounded_rectangle([60, y + 40, W - 60, y + 300], radius=28, fill="#eef4ff", outline="#5b7cfa", width=4)
d.text((100, y + 85), "“Show it, don't write it.”", font=F(54), fill="#2a3f9e")
d.text((100, y + 175), "—— 动画师的第一条规则", font=F(40), fill="#5b6aa8")
d.text((70, H - 90), "#动画 #短视频 #创作笔记", font=F(34), fill="#ff6b4a")
im.save(f"{out}/richtext.png")

# ---------- meme (two captions on a key frame) ----------
base = Image.open(sys.argv[2] if len(sys.argv) > 2 else "projects/flood/input/bridge.png").convert("RGB").resize((1280, 720))
d = ImageDraw.Draw(base)
def cap(txt, y, size):
    f = F(size); w = d.textlength(txt, font=f); d.text(((1280 - w) / 2, y), txt, font=f, fill="white", stroke_width=6, stroke_fill="black")
cap("老板：这个需求很简单", 24, 64); cap("需求：", 600, 70)
base.save(f"{out}/meme.png")
print("wrote", sorted(os.listdir(out)))
