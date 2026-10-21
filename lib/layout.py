#!/usr/bin/env python3
"""Layout probe for image inputs (poster / rich-text card / meme). No generative models: Tesseract OCR + OpenCV only.

  python3 lib/layout.py <image> [--lang=auto|eng|chi_sim+eng] [--out=layout.json] [--clean=plate.png]      (called by `c2v ingest` for images/PDFs)

Writes { size, lines: [{text, conf, box:[x,y,w,h]}], blocks: [{box, kind:'text'|'figure', lines:[i..]}], order: [block ids] }
  lines   OCR text lines (Tesseract TSV, level 4), boxes in source pixels
  blocks  connected regions of ink after dilation; a block whose area is mostly covered by OCR lines is 'text', else 'figure'
  order   reading order: column-major for multi-column layouts (posters), top-to-bottom otherwise
Set TESSDATA_PREFIX if chi_sim lives outside the system tessdata dir.
"""
import sys, os, re, json, subprocess, csv, io
import cv2, numpy as np

args = dict(a.lstrip('-').split('=', 1) if '=' in a else (a.lstrip('-'), True) for a in sys.argv[2:])
src = sys.argv[1]; lang = args.get('lang', 'auto'); out = args.get('out')
img = cv2.imread(src); H, W = img.shape[:2]

def caption_mask():
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    white = ((hsv[..., 2] > 225) & (hsv[..., 1] < 40)).astype(np.uint8) * 255
    return cv2.bitwise_and(white, cv2.dilate((g < 60).astype(np.uint8) * 255, np.ones((7, 7), np.uint8)))

def cjk_share(path, psm):
    t = subprocess.run(['tesseract', path, '-', '-l', 'chi_sim', '--psm', psm], capture_output=True, text=True).stdout
    t = re.sub(r'\s', '', t); return len(re.findall(r'[\u4e00-\u9fff]', t)) / max(1, len(t))

# --lang=auto: chi_sim+eng only when CJK is a real share of the text (chi_sim+eng drops the spaces between English words);
# the caption layer is probed too, because meme captions over a picture are invisible to page OCR
if lang == 'auto':
    has_chi = 'chi_sim' in subprocess.run(['tesseract', '--list-langs'], capture_output=True, text=True).stdout
    lang = 'eng'
    if has_chi:
        tmp = f'/tmp/_capmask_{os.getpid()}.png'; cv2.imwrite(tmp, 255 - caption_mask())
        share = max(cjk_share(src, '3'), cjk_share(tmp, '6')); os.remove(tmp)
        if share > .2: lang = 'chi_sim+eng'

# ---------- OCR lines ----------
tsv = subprocess.run(['tesseract', src, '-', '-l', lang, '--psm', '3', 'tsv'], capture_output=True, text=True).stdout
tsv = tsv[tsv.find('level\t'):] if 'level\t' in tsv else ''            # tesseract 4 prints resolution warnings before the header
rows = list(csv.DictReader(io.StringIO(tsv), delimiter='\t', quoting=csv.QUOTE_NONE))
groups = {}
for r in rows:
    if r['level'] != '5' or not r['text'].strip() or float(r['conf']) < 0: continue
    k = (r['block_num'], r['par_num'], r['line_num'])
    g = groups.setdefault(k, {'words': [], 'conf': [], 'x0': 1e9, 'y0': 1e9, 'x1': 0, 'y1': 0})
    x, y, w, h = (int(r[c]) for c in ('left', 'top', 'width', 'height'))
    g['words'].append(r['text']); g['conf'].append(float(r['conf']))
    g['x0'], g['y0'], g['x1'], g['y1'] = min(g['x0'], x), min(g['y0'], y), max(g['x1'], x + w), max(g['y1'], y + h)
cjk = 'chi' in lang

def caption_pass():
    """Meme captions: white glyphs with a dark outline over a picture. Isolate them, OCR the mask (psm 6)."""
    cap = caption_mask()
    n, _, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(cap, np.ones((15, 41), np.uint8)))
    found = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if w < W * .12 or h < 18: continue
        crop = 255 - cap[max(0, y - 6):y + h + 6, max(0, x - 6):x + w + 6]
        tmp = f'/tmp/_cap_{os.getpid()}_{i}.png'; cv2.imwrite(tmp, crop)
        t = subprocess.run(['tesseract', tmp, '-', '-l', lang, '--psm', '7'], capture_output=True, text=True).stdout.strip()
        os.remove(tmp)
        t = t.replace(' ', '') if cjk else t
        if len(t) >= 2: found.append({'text': t, 'conf': -1, 'box': [int(x), int(y), int(w), int(h)], 'caption': True})
    return found
lines = []
for g in groups.values():
    text = ('' if cjk else ' ').join(g['words']).strip()
    if len(text) < 2 and not cjk: continue
    lines.append({'text': text, 'conf': round(sum(g['conf']) / len(g['conf']), 1), 'box': [g['x0'], g['y0'], g['x1'] - g['x0'], g['y1'] - g['y0']]})
lines.sort(key=lambda l: (l['box'][1], l['box'][0]))
captions = caption_pass()

# ---------- blocks: ink regions ----------
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
bg = int(np.median(np.concatenate([gray[0], gray[-1], gray[:, 0], gray[:, -1]])))
ink = (np.abs(gray.astype(int) - bg) > 28).astype(np.uint8) * 255
k = max(9, W // 90)
mask = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))
n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
blocks = []
for i in range(1, n):
    x, y, w, h, a = stats[i]
    if w * h < W * H * .004 or w * h > W * H * .9: continue
    inside = [j for j, l in enumerate(lines) if x <= l['box'][0] + l['box'][2] / 2 <= x + w and y <= l['box'][1] + l['box'][3] / 2 <= y + h]
    cover = sum(lines[j]['box'][2] * lines[j]['box'][3] for j in inside) / float(w * h)
    blocks.append({'box': [int(x), int(y), int(w), int(h)], 'kind': 'text' if cover > .25 else 'figure', 'text_cover': round(cover, 2), 'lines': inside})

# reading order: columns by x-overlap, then top-to-bottom
blocks.sort(key=lambda b: b['box'][0])
cols = []
for b in [b for b in blocks if b['box'][2] <= W * .8]:          # full-width bands (titles) are not columns
    for c in cols:
        cx0, cx1 = c['x0'], c['x1']
        if min(cx1, b['box'][0] + b['box'][2]) - max(cx0, b['box'][0]) > .5 * min(b['box'][2], cx1 - cx0):
            c['items'].append(b); c['x0'], c['x1'] = min(cx0, b['box'][0]), max(cx1, b['box'][0] + b['box'][2]); break
    else: cols.append({'x0': b['box'][0], 'x1': b['box'][0] + b['box'][2], 'items': [b]})
ordered = []
full = [b for b in blocks if b['box'][2] > W * .8]          # full-width bands (title) go first
for b in sorted(full, key=lambda b: b['box'][1]): ordered.append(b)
for c in sorted(cols, key=lambda c: c['x0']):
    for b in sorted(c['items'], key=lambda b: b['box'][1]):
        if b not in ordered: ordered.append(b)
for i, b in enumerate(ordered): b['id'] = i

# what kind of document: a meme (picture + captions), a poster (many panels in columns), a card (text in one column)
text_area = sum(l['box'][2] * l['box'][3] for l in lines if l['conf'] >= 60) / float(W * H)
ncols = len([c for c in cols if (c['x1'] - c['x0']) > W * .15])
kind = 'meme' if captions and text_area < .06 else 'poster' if ncols >= 2 and W >= H else 'card' if text_area >= .03 else 'picture'
if kind != 'meme': captions = []                 # white-on-dark headings in posters/cards are not meme captions
# --clean=<png> (memes): the picture with its captions removed (glyphs + outline inpainted), to use as a plate.
# What was under a caption is invented by inpainting (Telea): fine for flat colour and texture, not for detail.
if kind == 'meme' and args.get('clean'):
    cap = cv2.bitwise_and(((cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 2] > 200) & (cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 1] < 60)).astype(np.uint8) * 255,
                          cv2.dilate((cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) < 60).astype(np.uint8) * 255, np.ones((7, 7), np.uint8)))
    m = np.zeros(cap.shape, np.uint8)
    for c in captions:
        x, y, w, h = c['box']; g = cv2.dilate(cap[y:y + h, x:x + w], np.ones((3, 3), np.uint8)); m[y:y + h, x:x + w] |= cv2.dilate(g, np.ones((15, 15), np.uint8))
    cv2.imwrite(args['clean'], cv2.inpaint(img, m, 9, cv2.INPAINT_TELEA))
res = {'source': src, 'size': [W, H], 'lang': lang, 'kind': kind, 'columns': ncols, 'text_area': round(text_area, 3), 'captions': captions, 'lines': lines, 'blocks': ordered,
       'stats': {'lines': len(lines), 'mean_conf': round(sum(l['conf'] for l in lines) / max(1, len(lines)), 1),
                 'text_blocks': sum(b['kind'] == 'text' for b in ordered), 'figure_blocks': sum(b['kind'] == 'figure' for b in ordered)}}
s = json.dumps(res, ensure_ascii=False, indent=1)
if out: open(out, 'w').write(s)
print(json.dumps({'kind': kind, 'columns': ncols, 'text_area': round(text_area, 3), **res['stats']}, ensure_ascii=False))
for c in captions: print(f"  caption {c['box']}  {c['text']}")
for l in lines: print(f"  {l['conf']:5.1f} {l['box']}  {l['text']}")
for b in ordered: print(f"  block {b['id']} {b['kind']:6} {b['box']} cover={b['text_cover']} lines={b['lines']}")
