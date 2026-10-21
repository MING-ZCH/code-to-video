#!/usr/bin/env python3
"""Text recall of a rendered video: does the text the source shows survive into the frames at its read times?

  python3 scripts/dev/text-recall.py <video.mp4> <checks.json> [--lang=eng|chi_sim+eng]

checks.json: [[t, ["expected line", ...]], ...]  (t = a read's middle, in seconds)
Each frame is OCR'd three ways (as is; inverted, for white-on-colour text; a caption mask, for outlined meme lettering) with sparse-text mode; a line counts as recovered
when it appears (normalised) or matches an OCR line with similarity >= 0.8. This is a LOWER bound on legibility:
Tesseract misses stylised text a viewer reads fine. Set TESSDATA_PREFIX if chi_sim lives outside the system tessdata.
"""
import sys, json, re, subprocess, difflib, os, tempfile
import cv2
import numpy as np

video, checks = sys.argv[1], json.load(open(sys.argv[2]))
args = dict(a[2:].split('=', 1) for a in sys.argv[3:] if a.startswith('--') and '=' in a)
lang = args.get('lang', 'eng'); cjk = 'chi' in lang
norm = lambda s: re.sub(r'\s+', '' if cjk else ' ', s).strip().lower().replace('’', "'").replace('：', ':')
tmp = tempfile.mkdtemp()
tot = hit = 0; rows = []
for t, expect in checks:
    f = os.path.join(tmp, f'f{t}.png')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(t), '-i', video, '-frames:v', '1', f], check=True)
    img = cv2.imread(f); g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); cv2.imwrite(f + '.inv.png', 255 - g)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)                 # meme lettering: white fill + dark outline, isolated as black on white
    cap = ((hsv[..., 2] > 200) & (hsv[..., 1] < 60)).astype('uint8') * 255          # white glyphs only (the outline is anti-aliased in video)
    cv2.imwrite(f + '.cap.png', 255 - cap)
    txt = ''
    for src in (f, f + '.inv.png', f + '.cap.png'):
        for psm in ('3', '11', '6'):
            txt += '\n' + subprocess.run(['tesseract', src, '-', '-l', lang, '--psm', psm], capture_output=True, text=True).stdout
    lines = [l for l in txt.split('\n') if l.strip()]
    for e in expect:
        tot += 1
        best = max((difflib.SequenceMatcher(None, norm(e), norm(l)).ratio() for l in lines), default=0)
        ok = norm(e) in norm(txt) or best >= .8; hit += ok
        rows.append((t, ok, round(best, 2), e))
for t, ok, b, e in rows: print(f'{t:6} {"OK  " if ok else "MISS"} {b:.2f}  {e}')
print(json.dumps({'video': video, 'recovered': hit, 'expected': tot, 'recall': round(hit / max(1, tot), 3)}, ensure_ascii=False))
