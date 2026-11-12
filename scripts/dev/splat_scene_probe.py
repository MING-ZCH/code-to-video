"""Probe a COLMAP capture + 3DGS export: orbit centre, up axis, radius, and the height profile near the centre.

Usage:
    python splat_scene_probe.py SPARSE_DIR SCENE.ply [E1_OFFSET E2_OFFSET]

With offsets, also report the captured surface height (opaque splats within 0.1 of the upright line through
focus + E1_OFFSET * e1 + E2_OFFSET * e2): where an inserted object must rest to touch the real surface.
"""

import struct
import sys
from pathlib import Path

import numpy as np
from plyfile import PlyData


def read_images(sparse: Path) -> list[tuple[str, np.ndarray, np.ndarray]]:
    """Return (name, R world->cam, t) for every registered image."""
    data = (sparse / "images.bin").read_bytes()
    n = struct.unpack_from("<Q", data, 0)[0]
    off, out = 8, []
    for _ in range(n):
        qw, qx, qy, qz, tx, ty, tz = struct.unpack_from("<7d", data, off + 4)
        off += 64
        end = data.index(b"\0", off)
        name = data[off:end].decode()
        off = end + 1
        npts = struct.unpack_from("<Q", data, off)[0]
        off += 8 + npts * 24
        r = np.array([
            [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qw * qz), 2 * (qx * qz + qw * qy)],
            [2 * (qx * qy + qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qw * qx)],
            [2 * (qx * qz - qw * qy), 2 * (qy * qz + qw * qx), 1 - 2 * (qx * qx + qy * qy)],
        ])
        out.append((name, r, np.array([tx, ty, tz])))
    return sorted(out)


def main(sparse: str, ply: str) -> None:
    imgs = read_images(Path(sparse))
    centers = np.array([-r.T @ t for _, r, t in imgs])
    dirs = np.array([r[2] for _, r, _ in imgs])
    # least-squares point closest to all optical axes
    a = np.zeros((3, 3))
    b = np.zeros(3)
    for c, d in zip(centers, dirs):
        p = np.eye(3) - np.outer(d, d)
        a += p
        b += p @ c
    focus = np.linalg.solve(a, b)
    up = -np.mean([r[1] for _, r, _ in imgs], axis=0)
    up /= np.linalg.norm(up)
    rel = centers - focus
    height = rel @ up
    radial = np.linalg.norm(rel - np.outer(height, up), axis=1)
    print("focus", np.round(focus, 3).tolist(), "up", np.round(up, 3).tolist())
    print(f"cam height above focus {height.mean():.3f}±{height.std():.3f}  radius {radial.mean():.3f}±{radial.std():.3f}")
    v = PlyData.read(ply)["vertex"]
    xyz = np.stack([v["x"], v["y"], v["z"]], 1)
    opa = 1 / (1 + np.exp(-np.asarray(v["opacity"])))
    rel = xyz - focus
    h = rel @ up
    r = np.linalg.norm(rel - np.outer(h, up), axis=1)
    for rmax in (0.3, 0.6, 1.0):
        sel = (r < rmax) & (opa > 0.5)
        hist, edges = np.histogram(h[sel], bins=24, range=(-1.2, 1.2))
        print(f"r<{rmax}: n={sel.sum()}  height histogram (bin start: count)")
        print("  " + "  ".join(f"{e:+.1f}:{c}" for e, c in zip(edges[:-1], hist)))
    # horizontal basis for boxes
    e1 = np.cross(up, [1, 0, 0])
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(up, e1)
    print("e1", np.round(e1, 3).tolist(), "e2", np.round(e2, 3).tolist())
    print("first cam centre", np.round(centers[0], 3).tolist())
    if len(sys.argv) > 4:
        c = focus + e1 * float(sys.argv[3]) + e2 * float(sys.argv[4])
        rel = xyz - c
        h = rel @ up
        r = np.linalg.norm(rel - np.outer(h, up), axis=1)
        sel = (r < 0.1) & (np.abs(h) < 0.15) & (opa > 0.5)
        print(f"surface height at contact: median {np.median(h[sel]):+.4f} (p10 {np.percentile(h[sel], 10):+.4f}, p90 {np.percentile(h[sel], 90):+.4f}, n={sel.sum()})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
