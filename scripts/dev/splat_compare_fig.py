"""Figure: real photo | code render | |error| ×4 for the median and the worst held-out view.

Usage:
    python splat_compare_fig.py METRICS.json RENDER_DIR GT_DIR OUT.jpg
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def row(view: str, render_dir: Path, gt_dir: Path, psnr: float, width: int = 640) -> Image.Image:
    """One row: photo, render and amplified absolute error, labelled."""
    gt = Image.open(next(gt_dir.glob(view + ".*"))).convert("RGB")
    rd = Image.open(render_dir / f"{view}.png").convert("RGB")
    err = np.abs(np.asarray(gt, np.float32) - np.asarray(rd, np.float32)).mean(2) * 4
    err_img = Image.fromarray(np.clip(err, 0, 255).astype(np.uint8)).convert("RGB")
    h = round(gt.height * width / gt.width)
    tiles = [im.resize((width, h), Image.LANCZOS) for im in (gt, rd, err_img)]
    out = Image.new("RGB", (width * 3, h), "black")
    labels = [f"real photo {view} (held out)", f"code render (WebGL) {psnr:.2f} dB", "|error| x4"]
    for k, (tile, lab) in enumerate(zip(tiles, labels)):
        out.paste(tile, (k * width, 0))
        d = ImageDraw.Draw(out)
        d.rectangle([k * width, 0, k * width + 8 * len(lab) + 12, 22], fill=(0, 0, 0))
        d.text((k * width + 6, 5), lab, fill=(255, 255, 255))
    return out


def main(metrics: str, render_dir: str, gt_dir: str, out: str) -> None:
    views = sorted(json.loads(Path(metrics).read_text())["views"], key=lambda r: r["psnr"])
    picks = [views[len(views) // 2], views[0]]
    rows = [row(v["view"], Path(render_dir), Path(gt_dir), v["psnr"]) for v in picks]
    fig = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)))
    y = 0
    for r in rows:
        fig.paste(r, (0, y))
        y += r.height
    fig.save(out, quality=88)
    print(out, [(v["view"], round(v["psnr"], 2)) for v in picks])


if __name__ == "__main__":
    main(*sys.argv[1:5])
