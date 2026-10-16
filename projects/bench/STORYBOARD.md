# bench: storyboard (24 s, 120 BPM, beat 0.5 s; six 4 s segments = 2 bars each)

> Case B. Input: `input/bench-meme.md`, a written description of the meme (the image itself wasn't available in the VM; when it's added, `c2v ingest bench <image>` supplies the palette and composition). Shader medium: one style per segment, sound made by code.

Logline: Clawd sits slumped on a park bench while the world ends behind it, again and again, in every art style there is, and doesn't care until the very end.
World: one composition throughout: a low green hill with a bench (left of centre), a small city skyline on the horizon, and the blast rising behind the city (right of centre). The base layer is painted in brush; each segment restyles the whole frame with its own shader.
Motif: the blast's flash. Every segment opens on it (a flash cut), which is the joke's rhythm. Clawd's beanie is a running prop: it's there in A–B, blown off by the shockwave in C, and gone in D–F.
Arc: bored → sleepy (yawn) → unbothered (hat gone) → content (sip) → distracted (phone) → cool (shades, to camera).

Shots (each: flash cut in; the blast rises; the shockwave reaches the bench at +1.6 s; one small Clawd action):
  A  0.00–4.00  [transition in: the flash, from white]  cave painting · wide · the blast rises; Clawd is a motionless bored lump
     reads:  0.00–0.80  flash → a figure on a bench, a cloud rising behind
             0.80–2.40  the mushroom grows; the shockwave hits the bench (shake)
             2.40–4.00  Clawd hasn't moved
  B  4.00–8.00  [transition: flash cut (next blast)]  ink wash · medium on Clawd · Clawd yawns through it
     reads:  4.00–4.80  new style, same moment
             4.80–6.40  the wave hits; Clawd's yawn
             6.40–8.00  back to bored
  C  8.00–12.00  [transition: flash cut]  stained glass · wide · the shockwave blows the beanie off; Clawd doesn't even look
     reads:  8.00–8.80  new style
             8.80–10.00 the wave; the beanie flies off on an arc
             10.00–12.00 Clawd: still nothing
  D  12.00–16.00  [transition: flash cut]  halftone comic · medium · Clawd sips from a mug
     reads:  12.00–12.80 new style
             12.80–14.40 the wave; Clawd lifts the mug
             14.40–16.00 the sip, content
  (review pass 2: the sip didn't read through stained-glass cells, so C and D swapped actions; the big beanie reads in any style)
  E  16.00–20.00  [transition: flash cut]  8-bit pixel · wide · Clawd scrolls a glowing phone
     reads:  16.00–16.80 new style
             16.80–18.40 the wave; the phone's glow on the face
             18.40–20.00 distracted
  F  20.00–24.00  [transition: flash cut]  blueprint ("the drawing was code all along") · close on Clawd · Clawd turns to camera and puts on shades
     reads:  20.00–20.80 new style, close
             20.80–22.20 Clawd turns to the viewer
             22.20–23.20 shades on: cool
             23.20–24.00 iris closes on the shades
  [transition out: iris close]

Sound (code): a boom on every flash; per-style music, two bars each, cut with the style: A tribal drums · B pentatonic chimes · C organ chord · D comic snare + pops · E square-wave arpeggio · F soft sine pulse; foley: yawn (glide down), sip (pop), whoosh for the hat, click for the phone, chime for the shades.
