"""real-human / robot: an anthropomorphic toy robot acting on a wooden desk, shot like a macro product photo.

Model: RobotExpressive (CC0, Tomás Laulhé). Its actions are sequenced with NLA strips and blended; its materials are
replaced by a glossy painted plastic and satin metal. The toy scale (≈ 25 cm) and an 85 mm lens at f/2 give the shallow
depth of field of real miniature photography. Edit parameters: paint colour, sequence, lens, aperture, HDRI rotation.
"""

from __future__ import annotations

import c2v_bpy as C

PARAMS = {
    "paint": [0.9, 0.38, 0.015],     # body paint (linear RGB)
    "sequence": [["Idle", 1, 0, 15], ["Wave", 16, 0, 44], ["ThumbsUp", 60, 0, 38], ["Dance", 98, 0, 80]],
    "lens": 85,
    "fstop": 2.0,
    "hdri_rot": 120.0,
    "height_m": 0.25,
}


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("studio", "env.hdr"), strength=0.9, rotation_deg=float(ctx.P("hdri_rot")), background=0.5)
    desk = C.texture_material("wood", ctx.asset("wood"), scale=3.0)
    C.ground(desk, size=6.0)

    # the model is ~4.5 units tall; scale it to a desk toy
    arm, meshes = C.import_gltf(ctx.asset("robot", "RobotExpressive.glb"), scale=float(ctx.P("height_m")) / 4.5, rotation_z_deg=0)
    C.nla_sequence(arm, [tuple(c) for c in ctx.P("sequence")], blend=6)
    C.restyle_materials(meshes, {
        "Main": {"Base Color": tuple(ctx.P("paint")), "Roughness": 0.32, "Coat Weight": 0.7, "Coat Roughness": 0.08, "Metallic": 0.0},
        "Grey": {"Base Color": (0.55, 0.56, 0.58), "Metallic": 0.85, "Roughness": 0.35},
        "Black": {"Base Color": (0.02, 0.02, 0.025), "Roughness": 0.12, "Coat Weight": 1.0},
    })
    C.area_light((-0.6, -0.8, 0.9), (0, 0, 0.12), power=60, size=0.6)
    C.area_light((0.7, 0.4, 0.5), (0, 0, 0.15), power=25, size=0.5, color=(0.8, 0.88, 1.0))
    f = ctx.frames
    C.camera([(1, (0.06, -1.9, 0.3), (0.0, 0.0, 0.15)), (f, (-0.1, -1.6, 0.3), (0.0, 0.0, 0.15))],
             lens=float(ctx.P("lens")), fstop=float(ctx.P("fstop")))
