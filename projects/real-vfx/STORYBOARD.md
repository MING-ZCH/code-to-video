# real-vfx: storyboard

Logline: a quiet rooftop car park at dusk; a charge goes off in front of the stairwell, throwing rock and a fireball that rolls up into black smoke.
Plate and light: Poly Haven `rooftop_night` (8k HDRI, CC0), both the background the camera sees and the only light besides the fire. A shadow catcher lays CG shadows and fire light onto the plate's real ground.
CG: Mantaflow gas (fuel → fire and smoke, noise up-res ×2), 48 Bullet rock chunks (Poly Haven concrete texture) pushed by a one-frame radial force at the ignition frame.
Composite: rotation-only impact shake, exposure flash, bloom/halation, grain; code sound (boom, rumble, two debris thuds) on the ignition constant.

Shots:
  A  0.00–3.50  [transition in: fade from black]  the empty car park (held 0.95 s so the place reads) · EVENT: ignition at 0.96 s, fireball, debris arcs and lands, smoke rises · locked-off camera, shake on impact
     reads:  0.00–0.95  the place, still
             0.96–1.60  ignition and fireball (flash, shake, boom)
             1.30–2.60  debris lands across the ground
             2.40–3.50  smoke column rises and darkens the stairwell
  [transition out: fade to black]
