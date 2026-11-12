"""Extract a clean silhouette mask from a portrait on a plain dark background.

Usage: python3 scripts/dev/silhouette.py <in.jpg> <out_mask.jpg> [--tol 22] [--width 1600] [--fill "x,y;x,y;..."]

The background is flood-filled from the top corners (colour tolerance ``tol``), the rest is the figure; holes are
filled, small specks removed and the edge smoothed. White = inside the figure.
"""

from __future__ import annotations

import argparse

import cv2
import numpy as np


def silhouette(img: np.ndarray, tol: int) -> np.ndarray:
    """Return a uint8 mask (255 inside the figure) for ``img`` (BGR) on a plain background.

    The background colour is the median of patches at the left and right edges at mid height (in front of the face and
    behind the neck in a profile portrait); pixels within ``tol`` of it in Lab are background. The figure is the
    largest remaining component touching the bottom edge, with holes filled and the edge smoothed.
    """
    h, w = img.shape[:2]
    lab = cv2.cvtColor(cv2.GaussianBlur(img, (0, 0), 2.5), cv2.COLOR_BGR2LAB).astype(np.float32)
    patches = [lab[int(h * y0):int(h * y1), int(w * x0):int(w * x1)].reshape(-1, 3) for x0, x1, y0, y1 in
               ((0.01, 0.06, 0.45, 0.60), (0.92, 0.99, 0.40, 0.55))]
    bgc = np.median(np.concatenate(patches), axis=0)
    dist = np.linalg.norm(lab - bgc, axis=2)
    fig = np.where(dist > tol, 255, 0).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    fig = cv2.morphologyEx(fig, cv2.MORPH_OPEN, k)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fig)
    bottom = set(np.unique(labels[-3:, :])) - {0}
    keep = max(bottom, key=lambda i: stats[i, cv2.CC_STAT_AREA])
    fig = np.where(labels == keep, 255, 0).astype(np.uint8)
    inv = 255 - fig                                              # fill holes: background not reachable from the top
    hh = np.zeros((h + 2, w + 2), np.uint8)
    for seed in ((0, 0), (w - 1, 0), (0, h // 2), (w - 1, h // 2)):
        if inv[seed[1], seed[0]]:
            cv2.floodFill(inv, hh, seed, 0)
    fig = fig | inv
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
    fig = cv2.morphologyEx(fig, cv2.MORPH_CLOSE, k)
    fig = cv2.GaussianBlur(fig, (0, 0), 3)
    return np.where(fig > 127, 255, 0).astype(np.uint8)


def main() -> None:
    """CLI entry point."""
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--tol", type=int, default=22)
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--fill", default="", help='polygons to add, normalised "x,y;x,y;..." (e.g. dark hair the colour test misses)')
    a = ap.parse_args()
    img = cv2.imread(a.src)
    m = (np.array(img.shape[:2]) * 0.025).astype(int)            # drop the panel / frame edge
    img = img[m[0]:-m[0], m[1]:-m[1]]
    s = a.width / img.shape[1]
    img = cv2.resize(img, (a.width, round(img.shape[0] * s)), interpolation=cv2.INTER_AREA)
    mask = silhouette(img, a.tol)
    if a.fill:
        pts = np.array([[float(v) for v in p.split(",")] for p in a.fill.split(";")]) * [mask.shape[1], mask.shape[0]]
        cv2.fillPoly(mask, [pts.astype(np.int32)], 255)
        mask = np.where(cv2.GaussianBlur(mask, (0, 0), 3) > 127, 255, 0).astype(np.uint8)
    cv2.imwrite(a.dst, mask, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"{a.dst}: {mask.shape[1]}x{mask.shape[0]}, inside {100 * (mask > 0).mean():.1f}%")


if __name__ == "__main__":
    main()
