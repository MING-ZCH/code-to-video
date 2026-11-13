"""real-human / dance: a 3D human dancing samba in a photo studio, path-traced.

Model and motion: Michelle with the SambaDance clip (Mixamo, via three.js examples). Lighting: Poly Haven
brown_photostudio_02 HDRI plus a soft key; floor: Poly Haven worn concrete. Edit parameters: clip window, key light
colour and power, HDRI rotation, lens, aperture.
"""

from __future__ import annotations

import c2v_bpy as C

PARAMS = {
    "clip_start": 90,          # first action frame used
    "key_color": [1.0, 0.93, 0.85],
    "key_power": 450.0,
    "hdri_rot": 40.0,
    "lens": 50,
    "fstop": 2.4,
}


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("studio", "env.hdr"), strength=0.8, rotation_deg=float(ctx.P("hdri_rot")), background=0.55)
    C.ground(C.texture_material("concrete", ctx.asset("floor"), scale=6.0), size=30)
    arm, meshes = C.import_gltf(ctx.asset("michelle", "Michelle.glb"), rotation_z_deg=0)
    C.restyle_materials(meshes, {"Ch03_Body": {"Roughness": 0.62, "Specular IOR Level": 0.3, "Coat Weight": 0.0}})
    a0 = float(ctx.P("clip_start"))
    C.nla_sequence(arm, [("SambaDance", 1, a0, a0 + ctx.frames)])
    C.area_light((-2.2, -2.6, 3.0), (0, 0, 1.0), power=float(ctx.P("key_power")), size=2.0, color=tuple(ctx.P("key_color")))
    C.area_light((2.5, 1.5, 2.2), (0, 0, 1.2), power=180, size=1.5, color=(0.8, 0.86, 1.0))
    f = ctx.frames
    C.camera([(1, (0.3, -4.6, 1.15), (0.0, 0.0, 0.92)), (f, (-0.25, -3.9, 1.1), (0.0, 0.0, 0.95))],
             lens=float(ctx.P("lens")), fstop=float(ctx.P("fstop")))
