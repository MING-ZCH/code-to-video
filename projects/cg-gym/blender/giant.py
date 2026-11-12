"""cg-gym: a gymnast's giant swings on the high bar, all from code: MPFB human, procedural apparatus, physics timing.

Human: MPFB 2 (MakeHuman for Blender, CC0 base mesh) with its default rig, procedural LAYERED skin, MakeHuman CC0 eyes;
the leotard and hair are material regions on the body (a leotard is skin-tight). Set: uneven bars built in code (wood
rail, red uprights, cables, blue mats) in Poly Haven's gym_01 HDRI. Motion: the body rotates about the bar with the
hands held on it by IK; the angle θ(t) comes from energy conservation of a body swinging about the bar
(ω² = ω_top² + 2 m g r (1 − cos θ) / I, θ = 0 in handstand), integrated at a fixed step, so it is fast through the
bottom and slow over the top as real giants are. The body arches through the bottom and hollows over the top.
"""

from __future__ import annotations

import math
import os

import addon_utils
import bpy
from mathutils import Vector

import c2v_bpy as C

PARAMS = {"bar_h": 2.5, "omega_top": 1.6, "r_com": 0.98, "k_gyr": 1.18, "start_theta": 0.35, "leotard": [0.32, 0.05, 0.38],
          "skin": [0.78, 0.55, 0.42], "hair": [0.05, 0.035, 0.025], "camera": "side"}


def swing_angles(ctx: C.Ctx) -> list[float]:
    """θ per frame (0 = handstand above the bar, π = hanging), from ω(θ) by energy conservation, 50 substeps per frame."""
    g, r, k, w0 = 9.81, float(ctx.P("r_com")), float(ctx.P("k_gyr")), float(ctx.P("omega_top"))
    th, out, dt = float(ctx.P("start_theta")), [], 1.0 / ctx.fps / 50
    for _ in range(ctx.frames):
        out.append(th)
        for _ in range(50):
            th += dt * math.sqrt(w0 * w0 + 2 * g * r * (1 - math.cos(th)) / (k * k))
    return out


def human(ctx: C.Ctx):
    """MPFB human with rig, skin, eyes, leotard and hair regions; returns (basemesh, rig)."""
    addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    base = HumanService.create_human(scale=0.1, macro_detail_dict={"gender": 0.0, "age": 0.45, "muscle": 0.75, "weight": 0.4, "height": 0.45,
                                                                   "proportions": 0.7, "cupsize": 0.35, "firmness": 0.7,
                                                                   "race": {"african": 0.1, "asian": 0.2, "caucasian": 0.7}})
    rig = HumanService.add_builtin_rig(base, "default", import_weights=True)
    HumanService.set_character_skin(None, base, skin_type="LAYERED")
    eyes = ctx.asset("mh_eyes", "high-poly", "high-poly.mhclo")
    try:
        HumanService.add_mhclo_asset(eyes, base, asset_type="Eyes", material_type="MAKESKIN")
    except Exception as e:                                       # eyes are a refinement; keep going without them
        print("C2V eyes failed:", e)
    # material regions in rest pose: leotard on the torso (not the arms), hair on the scalp
    leo = C.pbr_material("leotard", color=tuple(ctx.P("leotard")), roughness=0.32, coat=0.25)
    hair = C.pbr_material("hair", color=tuple(ctx.P("hair")), roughness=0.45)
    base.data.materials.append(leo); base.data.materials.append(hair)
    for mat in base.data.materials[:1]:
        for n in mat.node_tree.nodes:                            # warm the procedural skin a little
            if n.type == "GROUP" and "Color" in n.inputs:
                n.inputs["Color"].default_value = (*ctx.P("skin"), 1.0)
    mw = base.matrix_world
    zmax = max((mw @ v.co).z for v in base.data.vertices)
    for p in base.data.polygons:
        c = mw @ p.center
        if 0.80 * zmax < c.z < 0.82 * zmax + 0.01 and abs(c.x) > 0.08:      # leave shoulders bare: no-op band (kept simple)
            pass
        if 0.52 * zmax < c.z < 0.82 * zmax and abs(c.x) < 0.17:
            p.material_index = 1
        elif 0.47 * zmax < c.z <= 0.52 * zmax and abs(c.x) < 0.085 + (c.z - 0.47 * zmax) * 1.6:
            p.material_index = 1                                    # high-cut legs
        elif c.z > 0.925 * zmax and (c.y > -0.035 or c.z > 0.965 * zmax):
            p.material_index = 2                                    # scalp
    return base, rig, zmax


def apparatus(ctx: C.Ctx, h: float) -> None:
    """High bar of an uneven-bars set: wooden rail, red uprights, cables, blue landing mats."""
    wood = C.texture_material("rail", ctx.asset("wood"), scale=0.4)
    red = C.pbr_material("upright", color=(0.55, 0.05, 0.04), roughness=0.35, coat=0.4)
    steel = C.pbr_material("cable", color=(0.6, 0.6, 0.62), metallic=1.0, roughness=0.3)
    mat_blue = C.pbr_material("mat", color=(0.08, 0.16, 0.42), roughness=0.85)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=2.4, location=(0, 0, h), rotation=(0, math.pi / 2, 0))
    bpy.context.active_object.data.materials.append(wood)
    for x in (-1.2, 1.2):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=h, location=(x, 0, h / 2)); bpy.context.active_object.data.materials.append(red)
        for dy in (-1.6, 1.6):
            a, b = Vector((x, 0, h - 0.05)), Vector((x * 1.25, dy, 0.02))
            d = b - a
            bpy.ops.mesh.primitive_cylinder_add(radius=0.006, depth=d.length, location=(a + b) / 2)
            o = bpy.context.active_object; o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
            o.data.materials.append(steel)
    for x0, sy in ((0, 4.0),):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x0, 0, 0.1)); m = bpy.context.active_object
        m.scale = (3.0, sy, 0.2); m.data.materials.append(mat_blue)
        bev = m.modifiers.new("b", "BEVEL"); bev.width = 0.05; bev.segments = 4


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("gym", "env.hdr"), strength=1.0, rotation_deg=40)
    h = float(ctx.P("bar_h"))
    floor = C.pbr_material("floor", color=(0.35, 0.3, 0.26), roughness=0.6)
    bpy.ops.mesh.primitive_plane_add(size=40); bpy.context.active_object.data.materials.append(floor)
    apparatus(ctx, h)
    base, rig, zmax = human(ctx)
    pivot = bpy.data.objects.new("pivot", None); bpy.context.collection.objects.link(pivot); pivot.location = (0, 0, h)
    # hang the body below the bar: shoulders one arm-length under it, hands reaching up to the rail by IK
    bpy.context.view_layer.update()
    sh = rig.matrix_world @ rig.pose.bones["upperarm01.L"].head
    arm = sum(rig.pose.bones[b].length for b in ("upperarm01.L", "upperarm02.L", "lowerarm01.L", "lowerarm02.L")) * rig.matrix_world.to_scale().z
    rig.parent = pivot
    rig.location = (0, -sh.y, -(sh.z + 0.97 * arm))            # shoulders 0.97 arm-lengths under the rail: straight arms
    for side, x in (("L", 0.2), ("R", -0.2)):
        tgt = bpy.data.objects.new(f"hand_{side}", None); bpy.context.collection.objects.link(tgt); tgt.parent = pivot; tgt.location = (x if side == "L" else x, 0, 0)
        pole = bpy.data.objects.new(f"pole_{side}", None); bpy.context.collection.objects.link(pole); pole.parent = pivot; pole.location = (x * 1.5, 0.6, -0.4)
        pb = rig.pose.bones.get(f"lowerarm02.{side}") or rig.pose.bones.get(f"wrist.{side}")
        ik = pb.constraints.new("IK"); ik.target = tgt; ik.pole_target = pole; ik.chain_count = 4; ik.pole_angle = math.radians(-90)
    angles = swing_angles(ctx)
    for f, th in enumerate(angles, start=1):
        pivot.rotation_euler = (th - math.pi, 0, 0)             # θ = π: hanging straight down under the bar
        pivot.keyframe_insert("rotation_euler", frame=f)
        # body shape: arch through the bottom, hollow over the top (spine and hips bend about the bar axis)
        bend = 0.22 * math.cos(th) - 0.08
        for bn, w in (("spine03", 0.4), ("spine02", 0.35), ("spine01", 0.25)):
            b = rig.pose.bones.get(bn)
            if b:
                b.rotation_mode = "XYZ"; b.rotation_euler = (bend * w, 0, 0); b.keyframe_insert("rotation_euler", frame=f)
        for side in ("L", "R"):
            b = rig.pose.bones.get(f"upperleg01.{side}")
            if b:
                b.rotation_mode = "XYZ"; b.rotation_euler = (-bend * 0.5, 0, (0.06 if side == "L" else -0.06)); b.keyframe_insert("rotation_euler", frame=f)
    cam = ctx.P("camera")
    keys = [(1, (4.6, -1.9, 2.55), (0, 0, 2.55)), (ctx.frames, (4.3, -1.6, 2.55), (0, 0, 2.55))] if cam == "side" else [(1, (0.0, -6.0, 1.6), (0, 0, 1.9))]
    C.camera(keys, lens=22, fstop=2.8)
    bpy.context.scene.render.motion_blur_shutter = 0.3            # a fast shutter, as sports cameras use
    meta = {"theta_deg": [round(math.degrees(a) % 360, 1) for a in angles[::24]]}
    print("C2V swing", meta)
