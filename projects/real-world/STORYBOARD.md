# real-world: storyboard

Logline: the Artemis I launch, from the last seconds on the pad to the rocket clearing the tower, with the mission facts and a mission clock on screen.
Source: NASA, "Artemis I Launch (Press Site)" (images.nasa.gov, public domain), cut 42–58 s of the item.
Facts: title, date (2022-11-16), centre (MSFC) and the pad / site phrases are read from the item's metadata at render time (`ASSET_META.launch.facts`). Vehicle "SLS · Orion" is shown only when the description names the Space Launch System.
Judged value: `liftoff_st = 50.4` (source second of T-0). The RS-25 start glow appears at ≈ 44.0 s; SLS starts its core-stage engines 6.36 s before T-0. Change the param if a better reference is found; the clock follows it.

Shots:
  A  0.00–8.00  [transition in: fade from black]  the rocket on the pad lit by its engines · EVENT: booster ignition and liftoff, the rocket climbs past the tower · camera tilts up with it (virtual), slow push-in
     reads:  0.40–1.60  mission title, vehicle, date, pad
             1.60–3.00  the mission clock counting to T-0 (top right)
             3.00–7.20  liftoff and climb; clock turns amber at T+
  [transition out: fade to black]
