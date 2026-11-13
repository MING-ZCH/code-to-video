"""real-vfx: an explosion on a real rooftop car park at dusk, path-traced into the HDRI it is lit by.

The Poly Haven HDRI (rooftop_night, 8k) is both the background plate and the light; an invisible shadow catcher lays
the CG's shadows and fire light onto the plate's real ground. Fire and smoke are a Mantaflow gas simulation, debris are
Bullet rigid bodies pushed by a one-frame radial force. The camera is locked off; shake is added in the p5 composite as
rotation only, which stays consistent with an HDRI plate at infinity. Edit parameters: blast frame, fuel, fire,
smoke colour, debris count, push, HDRI rotation.
"""

from __future__ import annotations

import c2v_bpy as C

PARAMS = {
    "blast_frame": 24,
    "fuel": 2.2,
    "fire": 14.0,             # blackbody intensity of the flame
    "smoke": [0.085, 0.072, 0.064],
    "sparks": 600,
    "debris": 48,
    "push": 8000.0,
    "hdri_rot": 200.0,
    "resolution": 96,
    "noise": 2,          # Mantaflow noise up-res factor (detail without a finer base grid)
    "seed": 0,
}


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Base Contrast")
    bpy_scene = __import__("bpy").context.scene
    bpy_scene.cycles.volume_bounces = 2
    bpy_scene.cycles.volume_step_rate = 1.5
    C.hdri_world(ctx.asset("rooftop", "env.hdr"), strength=1.0, rotation_deg=float(ctx.P("hdri_rot")))
    C.physics_world(ctx, gravity=9.81, substeps=10, iterations=20)
    C.shadow_catcher()

    at, frame = (0.0, 0.0, 0.35), int(ctx.P("blast_frame"))
    rock = C.texture_material("rock", ctx.asset("chunk"), scale=1.0)
    C.debris(ctx, int(ctx.P("debris")), (0.0, 0.0), 1.1, rock, size=(0.07, 0.24), seed=int(ctx.P("seed")))
    C.radial_push((0.0, 0.0, -0.35), frame + 1, float(ctx.P("push")), reach=3.5)
    domain = C.explosion(ctx, at, frame, radius=0.7, resolution=int(ctx.P("resolution")), fuel=float(ctx.P("fuel")),
                         smoke_color=tuple(ctx.P("smoke")), fire=float(ctx.P("fire")), burst=10.0, noise=int(ctx.P("noise")))
    if int(ctx.P("sparks")):
        C.sparks(at, frame, count=int(ctx.P("sparks")), seed=int(ctx.P("seed")))
    C.camera([(1, (0.0, -14.0, 1.7), (0.0, 0.0, 2.3))], lens=30)
    C.bake_fluid(domain)
