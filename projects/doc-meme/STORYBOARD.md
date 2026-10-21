# doc-meme: storyboard (10 s, 96 BPM, beat 0.625 s)

> Probe case: a two-caption meme (`input/meme.png`). The picture is a real key frame (flood baseline, a storm and a flooded
> street). Captions: "老板：这个需求很简单" (top) and "需求：" (bottom, pointing at the picture).
> Ingest found it as a meme and isolated the captions (OCR misreads 板 → 碑; the source wording is used). It wrote a caption-free
> plate (`input/meme-clean.png`, inpainted).
> Approach: **setup → turn → punchline**, the meme's own two beats. Caption 1 is the boss's claim. The picture is "the requirement",
> revealed by a pull-back. Caption 2 lands on the reveal. Clawd plays the person who said yes. The captions are the meme's text,
> shown where the meme shows them (PROJECT.text = 'content').

Logline: "this requirement is easy" — then we see the requirement.
World: the meme's picture as a plate (1280×720, scaled to 1920×1080). Clawd stands in front of it on a desk-top strip at first, then is "in" the flood.
Arc: confident → stunned → resigned.

Shots:
  A  0.00–3.40  [transition in: flash]  a tight framing on one calm corner of the picture (the sky); Clawd, small desk strip, nods; caption 1 types on at the top: "老板：这个需求很简单" · Clawd thumbs up, happy
     reads:  0.00–1.20  Clawd at the desk, calm sky
             1.20–3.40  caption 1 (the boss's claim), Clawd's thumbs up
  B  3.40–7.20  [transition: camera move — the pull-back carries on]  pull back fast to the whole picture: the flood, the lightning, the raft; a lightning flash on the beat; Clawd's take (surprised, "!!") · caption 2 slams in: "需求：" with a shake
     reads:  3.40–5.00  the pull-back: the flood is revealed
             5.00–7.20  caption 2 "需求：" lands, Clawd's take
  C  7.20–10.00  [transition: whip pan down]  Clawd on a little raft of its own among the waves, holding a lantern, resigned (sweat), bobbing · iris out on Clawd
     reads:  7.20–8.60  Clawd on the raft, resigned
             8.60–10.00 iris closes on Clawd
  [transition out: iris close]

## Read targets

| read | focal element (id) | min |
|---|---|---|
| A caption 1 | caption1 | 400 px |
| B the flood | flood | 600 px |
| B caption 2 | caption2 | 200 px |
| C Clawd on the raft | clawd, raft | 150 px |

Sound: a calm pad; a ding on the thumbs up; thunder on the reveal; a slam for caption 2; rain bed; a sad trombone glide at the end.
