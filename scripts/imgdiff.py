#!/usr/bin/env python3
"""imgdiff.py a.png b.png [--out=diff.png]: where two frames differ (bbox, pixel count, max delta) + a highlighted diff image."""
import sys
import numpy as np
from PIL import Image
a, b = [np.asarray(Image.open(p).convert('RGB')).astype(int) for p in sys.argv[1:3]]
d = np.abs(a - b).max(axis=2); m = d > 0
print(f'differing px: {m.sum()} ({m.mean()*100:.3f}%)  max delta: {d.max()}', end='')
if m.any():
    ys, xs = np.where(m); print(f'  bbox x {xs.min()}-{xs.max()}  y {ys.min()}-{ys.max()}')
else: print()
out = [x.split('=', 1)[1] for x in sys.argv[3:] if x.startswith('--out=')]
if out and m.any():
    v = (a * .35).astype(np.uint8); v[m] = [255, 0, 255]; Image.fromarray(v).save(out[0])
