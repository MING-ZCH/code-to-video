# real-physics: storyboard

Logline: the word GRAVITY, cast in metal, is let go one letter at a time and lands on a concrete floor; the caption gives the acceleration that made it fall.
World: a photo studio (Poly Haven `brown_photostudio_02`, CC0) lighting a worn concrete floor (`concrete_floor_worn_001`, CC0); path-traced in Cycles, AgX view transform.
Physics: Bullet rigid bodies, baked. Each letter is a kinematic body until its release frame, then gravity, contact, friction and restitution take over. Variants change only physical inputs: material (and its restitution) or gravity (Earth 9.81, Moon 1.62 m/s²).

Shots:
  A  0.00–6.00  [transition in: fade from black]  the letters hang, then drop in turn and settle · EVENT: the word assembles itself on the floor · camera cranes up from floor level to a reading angle
     reads:  0.00–0.40  letters hanging in a studio
             0.30–2.40  the drops, one letter at a time (each landing reads: bounce, slide, settle)
             2.40–3.40  camera rises; the word reads
             3.40–5.30  caption: g = 9.81 m/s² · Earth · material
  [transition out: fade to black]
