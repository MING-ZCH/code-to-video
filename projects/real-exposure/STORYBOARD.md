# real-exposure: storyboard

Logline: the opening of a crime drama: a man's profile on a pale ground holds a misty moor where a lone figure stands among fading utility poles; the moor dissolves into an industrial plant whose steam rises to fill the head.
Sources: silhouette from "Portrait of a Man in Profile" (The Met, CC0) via `scripts/dev/silhouette.py --tol 16 --fill …` (the dark hair is added by a polygon: colour alone cannot separate it from the dark ground); moor rendered in Cycles from Poly Haven `misty_dawn` (CC0) with a 120 m fog volume; plant = Temelín cooling towers, Wikimedia Commons (Rkocman, CC BY-SA 4.0).
Look: low saturation grey-yellow, brown and coal black; film grain, scratches and dust, vignette. No title, names or captions.
Constraint: images appear only inside the silhouette (`footage(..., { mask })`): the outline is the mask itself, so smoke can never cross it.

Shots:
  A  0.00–12.00  [transition in: fade from pale]  EVENT 1: the moor inside the head (figure, poles, fog), slow push · EVENT 2 (6.0–8.2 s): the moor dissolves into the plant; steam climbs from the shoulder line into the head
     reads:  0.00–1.20  a profile silhouette on a pale ground
             1.20–6.00  inside: fog, a man in a coat, poles fading away
             6.00–8.20  dissolve to towers and steam
             8.20–11.20 steam rises and fills the head
  [transition out: fade]
