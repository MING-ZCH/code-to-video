"""real-physics: a title whose letters fall under gravity onto a concrete floor, path-traced.

Physics is Bullet rigid-body simulation (baked), lighting is a Poly Haven studio HDRI plus one soft key, the floor is a
Poly Haven PBR concrete. Edit parameters: word, material, gravity (m/s²), bounce, seed.
"""

from __future__ import annotations

import math

import c2v_bpy as C

PARAMS = {
    "word": "GRAVITY",
    "material": "gold",      # gold | chrome | copper | glass | rubber | marble
    "gravity": 9.81,         # Earth; the Moon is 1.62
    "bounce": None,          # restitution override; None = the material's own
    "height": 1.1,           # release height (m)
    "first_release": 8,      # frame of the first release
    "release_gap": 7,        # frames between releases
    "seed": 0,
}
BOUNCE = {"gold": 0.18, "chrome": 0.2, "copper": 0.18, "glass": 0.15, "rubber": 0.85, "marble": 0.12}
FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx)
    C.hdri_world(ctx.asset("studio", "env.hdr"), strength=0.9, rotation_deg=40, background=0.35)
    C.physics_world(ctx, gravity=float(ctx.P("gravity")))
    floor = C.texture_material("concrete", ctx.asset("floor"), scale=9.0)
    C.ground(floor, size=40, friction=0.7, bounce=0.5)

    material, seed = ctx.P("material"), int(ctx.P("seed"))
    mat = C.pbr_material("letters", material)
    bounce = ctx.P("bounce") if ctx.P("bounce") is not None else BOUNCE.get(material, 0.3)

    # lay the letters out by their real widths, centred on x = 0, hold each one above its slot (kinematic) and release
    # them one after another; from the release on, gravity, contact, friction and restitution decide everything
    letters = [C.text_mesh(ch, FONT, size=1.0, extrude=0.13, bevel=0.016) for ch in ctx.P("word")]
    gap = 0.16
    total = sum(o.dimensions.x for o in letters) + gap * (len(letters) - 1)
    x = -total / 2
    for i, obj in enumerate(letters):
        w = obj.dimensions.x
        r = lambda k: (C.hash01(i * 7.3 + k + seed * 13.1) - 0.5) * 2
        obj.location = (x + w / 2, 0.08 * r(1), float(ctx.P("height")) + 0.12 * r(5))
        obj.rotation_euler = (math.radians(5 * r(2)), math.radians(5 * r(3)), math.radians(6 * r(4)))
        obj.data.materials.append(mat)
        C.rigid(obj, mass=2.0, friction=0.8, bounce=bounce, shape="CONVEX_HULL", damping=(0.04, 0.35))
        C.release_at(obj, int(ctx.P("first_release") + ctx.P("release_gap") * i))
        x += w + gap

    C.area_light((-4.0, -5.0, 6.0), (0, 0, 0), power=900, size=4.0)
    C.area_light((5.0, 3.0, 4.0), (0, 0, 0.5), power=350, size=3.0, color=(0.85, 0.9, 1.0))
    f = ctx.frames
    C.camera([(1, (0.0, -6.6, 1.0), (0.0, 0.0, 0.9)),
              (int(f * 0.45), (0.8, -5.4, 2.5), (0.0, 0.0, 0.2)),
              (f, (-0.3, -4.3, 3.6), (0.0, 0.15, 0.05))], lens=38, fstop=2.8)
