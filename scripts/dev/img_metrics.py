"""Full-reference image metrics (PSNR, SSIM, LPIPS-VGG) between renders and real photos.

Usage:
    python img_metrics.py RENDER_DIR GT_DIR [--json OUT.json]

Files are matched by stem. Renders must be at the photo's size (a smaller render
compared with a downscaled photo would score higher than it should).
"""

import argparse
import json
from pathlib import Path

import lpips
import numpy as np
import torch
from PIL import Image
from skimage.metrics import peak_signal_noise_ratio, structural_similarity


def load_rgb(path: Path, size: tuple[int, int] | None = None) -> np.ndarray:
    """Load an image as float32 RGB in [0, 1], optionally resized to (w, h)."""
    img = Image.open(path).convert("RGB")
    if size is not None and img.size != size:
        img = img.resize(size, Image.LANCZOS)
    return np.asarray(img, dtype=np.float32) / 255.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("render_dir", type=Path)
    parser.add_argument("gt_dir", type=Path)
    parser.add_argument("--json", type=Path, default=None)
    args = parser.parse_args()

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    lpips_vgg = lpips.LPIPS(net="vgg", verbose=False).to(device).eval()
    gt_by_stem = {p.stem: p for p in args.gt_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}}

    rows = []
    resized = 0
    for render_path in sorted(args.render_dir.glob("*.png")):
        gt_path = gt_by_stem.get(render_path.stem)
        if gt_path is None:
            continue
        render = load_rgb(render_path)
        h, w = render.shape[:2]
        gt_size = Image.open(gt_path).size
        if gt_size != (w, h):
            raise SystemExit(f"{render_path.name}: render {w}x{h} differs from photo {gt_size[0]}x{gt_size[1]}")
        gt = load_rgb(gt_path)
        psnr = peak_signal_noise_ratio(gt, render, data_range=1.0)
        # 11x11 Gaussian window, sigma 1.5, population covariance: the SSIM used by 3DGS and NerfBaselines
        ssim = structural_similarity(gt, render, channel_axis=2, data_range=1.0, gaussian_weights=True, sigma=1.5,
                                     use_sample_covariance=False)
        with torch.no_grad():
            to_t = lambda a: torch.from_numpy(a).permute(2, 0, 1)[None].to(device) * 2 - 1
            lp = float(lpips_vgg(to_t(render), to_t(gt)))
        rows.append({"view": render_path.stem, "psnr": float(psnr), "ssim": float(ssim), "lpips_vgg": lp})

    if not rows:
        raise SystemExit("no render matches a photo by name")
    mean = {k: float(np.mean([r[k] for r in rows])) for k in ("psnr", "ssim", "lpips_vgg")}
    print(f"views={len(rows)} resized_gt={resized} PSNR={mean['psnr']:.2f} SSIM={mean['ssim']:.3f} LPIPS(VGG)={mean['lpips_vgg']:.3f}")
    if args.json:
        args.json.write_text(json.dumps({"mean": mean, "views": rows, "resized_gt": resized}, indent=1))


if __name__ == "__main__":
    main()
