# Input brief: poster.pdf (pdf)

Measured by `c2v ingest` (parsing and signal analysis only, no models). Use it to write STORYBOARD.md.

- size: 3200x2000
- palette: #f3f5f9 (45%), #30566f (16%), #fefeff (14%), #eee9e5 (10%), #a39e8a (9%), #bdc2cb (7%)
- reference: input/reference.jpg
- document: **poster** (3 column(s), text covers 9% of the page, 30 OCR lines, mean confidence 86); full layout: input/layout-poster.pdf.json

## Regions in reading order

| # | kind | box (x, y, w, h) | text |
|---|---|---|---|
| 0 | text | 0, 0, 3200, 281 | PixelFree: Turning Posters into Videos with Programs / A. Author, B. Author - Example Univ |
| 1 | figure | 66, 346, 948, 1548 | 1. Motivation / Video models give pixels; / programs give editable, / diffable, reproducib |
| 2 | figure | 108, 1388, 864, 344 | frame(t) = f(t), no model |
| 3 | figure | 1126, 346, 948, 1548 | 2. Method / layout > storyboard — frames |
| 4 | figure | 1308, 568, 584, 1024 |  |
| 5 | figure | 2186, 346, 948, 1548 | 3. Results / 80 / 73.4 / 70 4 / = 60 55.8 / N 41.2 / 3 40 / o@ 30 / 204 / 105 / 0 T T / sl |

OCR is a draft: check every line against the reference before it goes on screen.

## Embedded PDF text (exact)

```
           PixelFree: Turning Posters into Videos with Programs
                              A. Author, B. Author · Example University · Probe input for code-to-video


1. Motivation                                 2. Method                                                       3. Results
Video models give pixels;
programs give editable,                                       Parse                                                80
                                                                                                                                                  73.4
                                                                                                                   70
diffable, reproducible                                                                                             60                 55.8




                                                                                              PaperQuiz acc. (%)
frames. We parse the poster                                                                                        50
                                                                                                                        41.2
layout, then animate each                                                                                          40

panel in reading order.
                                                               Plan                                                30

                                                                                                                   20

Key idea                                                                                                           10

                                                                                                                   0
                                                                                                                        slides       video gen    ours
                                                             Render
   frame(t) = f(t), no model
                                                                                                              Ours +17.6 over the best baseline
                                                                                                              (synthetic numbers for the probe)
                                                    layout storyboard frames
```
