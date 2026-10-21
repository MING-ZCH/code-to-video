# doc-poster: storyboard (14 s, 100 BPM, beat 0.6 s)

> Probe case: a paper poster (`input/poster.pdf`, a synthetic 3-column poster; text from the PDF itself, layout from `c2v ingest`).
> Approach: **the poster is the set**. A camera tours its regions in reading order (from `layout-poster.pdf.json`).
> The poster's own pixels are the plate (`plate()`); Clawd acts each panel's claim. The method boxes and the chart are rebuilt
> as painted, animated objects, so the numbers grow instead of sitting still. The words on screen are the poster's own words,
> shown where the poster shows them (PROJECT.text = 'content').

Logline: a poster says "programs, not pixels"; Clawd walks through it and makes each panel happen.
World: the poster at 3200×2000 world px, on paper. Palette from the brief: navy #1f3b6f, panel #f4f6fa, method blue/orange/green, highlight orange #b4472b.
Motif: the green "ours" bar, which grows past the two grey bars.
Arc: curious → busy → proud.

Shots:
  A  0.00–3.00  [transition in: iris open on the title]  the whole poster, then a push to the title; Clawd pops up from below the title band, reads it, "!" · push 0.55→0.9
     reads:  0.00–1.20  the whole poster (one read: it is a poster with three panels)
             1.20–3.00  the title, Clawd under it
  B  3.00–6.40  [transition: camera move — the pan carries to panel 1]  panel 1, Motivation: the text lines are typed out; the key-idea box is highlighted with a marker stroke; Clawd points at it
     reads:  3.00–4.60  "Video models give pixels; programs give editable…" typed
             4.60–6.40  key idea: frame(t) = f(t), the marker sweeps
  C  6.40–9.80  [transition: whip pan right]  panel 2, Method: Parse → Plan → Render light up in order; Clawd carries a sheet of paper from box to box along the arrows
     reads:  6.40–7.50  parse
             7.50–8.60  plan
             8.60–9.80  render
  D  9.80–14.00  [transition: cut on action — Clawd's throw of the sheet carries into panel 3, closer]  panel 3, Results: the bars grow from 0 on the beats; "ours" overtakes; Clawd cheers; pull back to the whole poster; iris out
     reads:  9.80–11.40 the bars grow: 41.2, 55.8
             11.40–12.80 ours: 73.4, +17.6
             12.80–14.00 the whole poster again, Clawd proud
  [transition out: iris close]

## Read targets

| read | focal element (id) | min |
|---|---|---|
| A the title | title | 300 px |
| B the key idea | keyIdea | 200 px |
| C parse / plan / render | parse, plan, render | 150 px |
| D the bars | bars | 250 px |
| D ours | ours | 80 px |

## Props table

| prop | planted | crosses | leaves |
|---|---|---|---|
| sheet (held) | C: picked up at Parse | C→D (thrown into the chart) | lands on the green bar |

## Framing table

| shot | zoom / centre | note |
|---|---|---|
| A | 0.55 whole → 0.9 on the title | |
| B | 1.2 on panel 1 | |
| C | 1.15 on panel 2 | |
| D | 1.4 on the chart → 0.55 whole | the cut on action changes zoom ×1.2 and the centre by a panel |

Sound: a page rustle at the iris; typing clicks; a pop per method box; whoosh on the whip; a rising tone per bar; a chime when ours passes; a pad under the pull-back.
