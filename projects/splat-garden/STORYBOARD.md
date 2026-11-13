# splat-garden: storyboard

Logline: a real garden table, photographed once (185 photos), filmed again from code — the camera, the paint on the
table, what stands on it and what bounces on it are parameters.

World: Mip-NeRF 360 "garden" capture (Barron et al., CVPR 2022), trained into 3D Gaussians with Brush (30k steps, every
8th photo held out). Rendered by engine/splat.js (WebGL2, SH degree 3), graded lightly.

Shots:
  A  0.00–10.00  orbit 70° around the table at the capture's radius, easing, with a 12 % push-in
     reads: 0.40–3.80  caption: 实拍采集 · 代码渲染

Variants (layers, `layer` param; edit pairs in pairs.json):
  orbit        base camera move
  orbit_tint   the table recoloured blue (splats inside the table cylinder, DC colour shifted, view-dependent detail kept)
  orbit_nopot  the pot and plant deleted (what was never photographed behind them becomes a hole)
  orbit_ball   a procedural ball (2,400 Gaussians) dropped on the table, bounce times from free fall with restitution 0.72
  orbit_high   the same move 0.6 higher, looking down
