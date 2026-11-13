"""real-domino: wooden plaques set out as a heart, toppled by a fingertip, shot from above.

Physics: Bullet rigid bodies (boxes), baked, with friction, restitution and sliding; nothing is keyframed after the push.
Layout: the classic heart curve, Chaikin-smoothed so the chain can turn its corners, resampled at equal arc length; every
plaque faces along the path so the wave runs around the heart. Faces: raw plywood on the front, red lacquer with a gold
pattern on the back, so the heart turns red as it falls (the back ends up on top). Edit parameters: count, spacing,
plaque size, friction, restitution, back colour, push frame.
"""

from __future__ import annotations

import math

import bpy
import c2v_bpy as C

PARAMS = {
    "heart_width": 1.3,        # m
    "tip_radius": 0.16,        # m: the rounded tip (a sharp point stops the chain)
    "spacing": 0.062,          # m between plaque centres along the path
    "size": [0.05, 0.012, 0.1],  # width, thickness, height (m)
    "friction": 0.45,
    "bounce": 0.15,
    "back": [0.32, 0.012, 0.008],  # red lacquer (linear RGB)
    "push_frame": 24,
}


def heart_path(width: float, spacing: float, tip_radius: float = 0.16) -> list[tuple[float, float, float]]:
    """Points (x, y, heading) at equal arc length around a heart built from arcs and tangent lines.

    Two lobes of radius width/4 meet at the dip (0, 0); external tangents run from each lobe to a rounded tip of
    ``tip_radius``. Travel is clockwise from the dip, so the chain climbs the right lobe first. Every turn is an arc, so a
    falling plaque always reaches the next one.
    """
    R = width / 4
    cl, cb = (R, 0.0), (0.0, -2.3 * R)
    d = (cb[0] - cl[0], cb[1] - cl[1])
    L, phi = math.hypot(*d), math.atan2(d[1], d[0])
    alpha = phi + math.acos((R - tip_radius) / L)               # outward normal of the right-hand external tangent
    a_lobe_end = alpha                                          # right lobe: angles pi -> alpha (clockwise)
    p1 = (cl[0] + R * math.cos(alpha), cl[1] + R * math.sin(alpha))
    p2 = (cb[0] + tip_radius * math.cos(alpha), cb[1] + tip_radius * math.sin(alpha))
    a_tip_end = math.pi - alpha                                 # tip arc: alpha -> pi - alpha (clockwise, through -pi/2)
    pts = []

    def arc(c, r, a0, a1, n):
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))

    def line(a, b, n):
        for i in range(1, n):
            pts.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))

    arc(cl, R, math.pi, a_lobe_end - 2 * math.pi if a_lobe_end > 0 else a_lobe_end, 400)
    line(p1, p2, 200)
    arc(cb, tip_radius, alpha, a_tip_end - 2 * math.pi, 200)
    q2 = (cb[0] + tip_radius * math.cos(a_tip_end), cb[1] + tip_radius * math.sin(a_tip_end))
    q1 = (-cl[0] + R * math.cos(a_tip_end), cl[1] + R * math.sin(a_tip_end))
    line(q2, q1, 200)
    arc((-R, 0.0), R, a_tip_end, -0.0001, 400)
    out, acc, nxt_at = [], 0.0, 0.0
    for a, b in zip(pts, pts[1:]):
        seg = math.dist(a, b)
        while seg > 0 and acc + seg >= nxt_at:
            k = (nxt_at - acc) / seg
            out.append((a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, math.atan2(b[1] - a[1], b[0] - a[0])))
            nxt_at += spacing
        acc += seg
    # the outline starts and ends at the dip: drop the tail plaques that would stand on the first ones
    while len(out) > 2 and math.dist(out[-1][:2], out[0][:2]) < 2.2 * spacing:
        out.pop()
    return out


def plaque_material(ctx: C.Ctx) -> bpy.types.Material:
    """Plywood on faces whose object-space normal points to -Y (front), lacquer with a pattern on +Y (back)."""
    mat = C.texture_material("plaque", ctx.asset("plywood"), scale=0.25)
    nt = mat.node_tree
    wood = nt.nodes["Principled BSDF"]
    lac = nt.nodes.new("ShaderNodeBsdfPrincipled")
    lac.inputs["Roughness"].default_value = 0.28
    lac.inputs["Coat Weight"].default_value = 0.8
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "RINGS"
    wave.inputs["Scale"].default_value = 18.0
    wave.inputs["Distortion"].default_value = 2.5
    pattern = nt.nodes.new("ShaderNodeMix")
    pattern.data_type = "RGBA"
    pattern.inputs[6].default_value = (*ctx.P("back"), 1.0)
    pattern.inputs[7].default_value = (0.75, 0.5, 0.12, 1.0)
    sharp = nt.nodes.new("ShaderNodeMath")
    sharp.operation = "GREATER_THAN"
    sharp.inputs[1].default_value = 0.82
    coord = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(coord.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], sharp.inputs[0])
    nt.links.new(sharp.outputs["Value"], pattern.inputs[0])
    nt.links.new(pattern.outputs[2], lac.inputs["Base Color"])
    side = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Normal"], side.inputs["Vector"])
    is_back = nt.nodes.new("ShaderNodeMath")
    is_back.operation = "GREATER_THAN"
    is_back.inputs[1].default_value = 0.5
    nt.links.new(side.outputs["Y"], is_back.inputs[0])
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(is_back.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(wood.outputs["BSDF"], mix.inputs[1])
    nt.links.new(lac.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], nt.nodes["Material Output"].inputs["Surface"])
    return mat


def measure(ctx: C.Ctx) -> dict:
    """After the bake: the frame each plaque passes 60° of tilt (its impact on the next), for sound sync and checks."""
    from mathutils import Vector

    scene = bpy.context.scene
    plaques = sorted((o for o in scene.objects if o.name.startswith("plaque_")), key=lambda o: o.name)
    falls = [None] * len(plaques)
    for f in range(1, ctx.frames + 1):
        scene.frame_set(f)
        for i, o in enumerate(plaques):
            if falls[i] is None and (o.matrix_world.to_3x3() @ Vector((0, 0, 1))).z < 0.5:
                falls[i] = f
    done = [f for f in falls if f is not None]
    return {"plaques": len(plaques), "fallen": len(done), "fall_frames": falls,
            "wave_per_s": round((len(done) - 1) * ctx.fps / max(1, max(done) - min(done)), 1) if len(done) > 1 else 0}


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("studio", "env.hdr"), strength=0.6, rotation_deg=60, background=0.4)
    C.physics_world(ctx, gravity=9.81, substeps=60, iterations=40)
    C.ground(C.texture_material("table", ctx.asset("table"), scale=2.0), size=8, friction=0.5, bounce=0.1)

    w, th, h = ctx.P("size")
    mat = plaque_material(ctx)
    path = heart_path(float(ctx.P("heart_width")), float(ctx.P("spacing")), float(ctx.P("tip_radius")))
    cy = sum(p[1] for p in path) / len(path)
    for i, (x, y, heading) in enumerate(path):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y - cy, h / 2))
        o = bpy.context.active_object
        o.name = f"plaque_{i:03d}"
        o.scale = (w, th, h)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bev = o.modifiers.new("bevel", "BEVEL")
        bev.width = 0.0012
        bev.segments = 2
        o.rotation_euler = (0, 0, heading - math.pi / 2 + math.pi)   # local -Y (front) faces backwards along the path
        o.data.materials.append(mat)
        C.rigid(o, mass=0.03, friction=float(ctx.P("friction")), bounce=float(ctx.P("bounce")), shape="BOX", damping=(0.02, 0.05))
    # the fingertip: a kinematic capsule that presses the first plaque forward along the path, then lifts away
    x0, y0, hd = path[0]
    y0 -= cy
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.009, location=(0, 0, 0))
    tip = bpy.context.active_object
    tip.name = "fingertip"
    tip.scale = (1.0, 1.0, 2.6)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    skin = C.pbr_material("skin", color=(0.8, 0.55, 0.45), roughness=0.45, subsurface=0.6)
    tip.data.materials.append(skin)
    C.rigid(tip, mass=1.0, friction=0.6, bounce=0.0, shape="CAPSULE")
    tip.rigid_body.kinematic = True
    back = (-math.cos(hd), -math.sin(hd))
    pf = int(ctx.P("push_frame"))
    for f, d, z in ((1, 0.05, 0.16), (pf - 10, 0.035, 0.085), (pf, 0.012, 0.085), (pf + 4, -0.012, 0.085), (pf + 14, 0.02, 0.2)):
        tip.location = (x0 + back[0] * d, y0 + back[1] * d, z)
        tip.keyframe_insert("location", frame=f)
    tip.rotation_euler = (math.radians(-25) * back[1], math.radians(25) * back[0], 0)
    C.area_light((-1.6, 0.9, 1.6), (0, 0, 0), power=90, size=2.5)
    f = ctx.frames
    C.camera([(1, (0.0, -0.06, 2.6), (0.0, -0.02, 0.0)), (f, (0.0, -0.04, 2.2), (0.0, -0.02, 0.0))], lens=32, fstop=5.6)
