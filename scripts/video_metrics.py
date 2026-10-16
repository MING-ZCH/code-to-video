#!/usr/bin/env python3
"""video_metrics.py: cheap, reproducible timing/motion metrics for any MP4 (baselines and our renders alike).

  python3 scripts/video_metrics.py a.mp4 [b.mp4 ...] --out=reports/x/metrics.json [--sheets=reports/x]

Only needs ffmpeg + numpy. Frames are decoded at 12 fps, 160x90 grayscale, so a 4-minute video takes seconds.

Metrics (per video):
  duration_s, fps, size
  cuts            frame-to-frame change spikes (mean abs diff > CUT and > 3x the local median): hard cuts and fast wipes
  shot_len_s      mean / median / p10 / p90 of the spans between cuts
  shots_1p4_4s    share of shots inside the storyboard rule's 1.4–4 s window
  still_ratio     share of 1/12 s steps where the picture barely changes (mean abs diff < STILL): the "frozen frame" rule
  motion_mean     mean abs diff per step (0–255 scale): overall liveliness
  bottom_band_text  share of sampled frames whose bottom 22% band has dense horizontal edge texture typical of
                  subtitles / karaoke lines (heuristic; confirm visually on the sheets)
"""
import json, subprocess, sys, os
import numpy as np

W, H, FPS = 160, 90, 12
CUT, STILL = 28.0, 0.6


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,r_frame_rate:format=duration',
                          '-of', 'json', path], capture_output=True, text=True, check=True).stdout
    j = json.loads(out); s = j['streams'][0]; n, d = s['r_frame_rate'].split('/')
    return float(j['format']['duration']), float(n) / float(d), f"{s['width']}x{s['height']}"


def frames(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-an', '-vf', f'fps={FPS},scale={W}:{H},format=gray', '-f', 'rawvideo', '-'],
                       capture_output=True, check=True).stdout
    return np.frombuffer(p, np.uint8).reshape(-1, H, W).astype(np.float32)


def text_band(path):
    """Share of 1 fps samples with a subtitle/karaoke line in the bottom band (640x360 pass; small text vanishes at 160x90).
    Calibrated on the three baselines: subtitle rows reach a per-row edge density of .18-.45, frames without them stay < .07."""
    w, h = 640, 360
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-an', '-vf', f'fps=1,scale={w}:{h},format=gray', '-f', 'rawvideo', '-'],
                       capture_output=True, check=True).stdout
    F = np.frombuffer(b, np.uint8).reshape(-1, h, w).astype(np.float32)
    hits = 0
    for f in F:
        band = f[int(h * .80):int(h * .97), int(w * .15):int(w * .85)]
        rows = (np.abs(np.diff(band, axis=1)) > 45).mean(axis=1)
        hits += rows.max() > .12
    return hits / max(1, len(F))


def metrics(path):
    dur, fps, size = probe(path)
    F = frames(path)
    d = np.abs(np.diff(F, axis=0)).mean(axis=(1, 2))
    med = np.array([np.median(d[max(0, i - 12):i + 12]) for i in range(len(d))])
    cut_idx = [i for i in range(len(d)) if d[i] > CUT and d[i] > 3 * med[i] + 1]
    merged = []
    for i in cut_idx:                      # one cut per 0.25 s
        if not merged or i - merged[-1] > 3: merged.append(i)
    bounds = [0] + [(i + 1) / FPS for i in merged] + [len(F) / FPS]
    shots = np.diff(bounds)
    tb = text_band(path)
    return {
        'file': os.path.basename(path), 'duration_s': round(dur, 2), 'fps': fps, 'size': size,
        'cuts': len(merged), 'cut_times_s': [round((i + 1) / FPS, 2) for i in merged],
        'shot_len_s': {k: round(float(v), 2) for k, v in
                       dict(mean=shots.mean(), median=np.median(shots), p10=np.percentile(shots, 10), p90=np.percentile(shots, 90)).items()},
        'shots_1p4_4s': round(float(((shots >= 1.4) & (shots <= 4)).mean()), 3),
        'still_ratio': round(float((d < STILL).mean()), 3),
        'motion_mean': round(float(d.mean()), 2),
        'bottom_band_text': round(float(tb), 3),
    }


def sheet(path, outdir, every=6):
    b = os.path.splitext(os.path.basename(path))[0]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', f'fps=1/{every},scale=320:-1,tile=6x7', '-frames:v', '1',
                    f'{outdir}/{b}-sheet.jpg'], check=True)


if __name__ == '__main__':
    files = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    res = []
    for f in files:
        m = metrics(f); res.append(m)
        print(json.dumps({k: v for k, v in m.items() if k != 'cut_times_s'}, ensure_ascii=False))
        if 'sheets' in opts: os.makedirs(opts['sheets'], exist_ok=True); sheet(f, opts['sheets'])
    if 'out' in opts:
        os.makedirs(os.path.dirname(opts['out']) or '.', exist_ok=True)
        json.dump(res, open(opts['out'], 'w'), ensure_ascii=False, indent=1)
