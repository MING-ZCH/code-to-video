"""film-street: a woman walks down a cobbled street at night, from code and libraries only.

Rocketbox avatar (Female_Adult_05, the woman of film-cafe; MIT) driven by a motion-captured walk (f_walk_neutral)
through C.drive_biped; the capture's own forward travel (on the armature object) is removed so the cycle repeats in
place with an NLA strip. Forward speed is
solved from the walk: in place, a planted foot slides backwards at the walking speed, so the root moves forward at the
median backward speed of the feet over their stance phases (toe within 8 mm of its lowest height). Poly Haven
cobblestone_street_night HDRI (CC0) lights the scene and is the background; a shadow catcher puts her shadow on the
street. She walks down the open street towards a camera that only turns to follow her (consistent with the environment
map at infinity), at about the HDRI's capture height so the horizon lines up.
measure() reports the solved speed and the foot slide during stance for the solved speed and for a fixed 1.4 m/s.
"""
from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector

import c2v_bpy as C

PLANTED = 0.008                                 # a toe within 8 mm of its lowest height counts as planted
PARAMS = {"hdri_rot": 45, "speed": "solved", "fixed_speed": 1.4, "approach": 9.0, "stop_short": 3.2, "lens": 50, "fstop": 2.0}


def stance_velocities(ctx: C.Ctx, rig: bpy.types.Object, frames: int) -> list[Vector]:
    """In place: horizontal velocity of each toe on the frames it is planted (toe within PLANTED of its lowest height).
    Jumps where the cycle wraps (over 4 m/s) are dropped."""
    scene, dt = bpy.context.scene, 1.0 / ctx.fps
    toes = {s: [] for s in ("L", "R")}
    for f in range(1, frames + 1):
        scene.frame_set(f)
        ev = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for s in toes:
            toes[s].append(ev.matrix_world @ ev.pose.bones[f"Bip01 {s} Toe0"].head)
    out = []
    for ps in toes.values():
        zmin = min(p.z for p in ps)
        for i in range(len(ps) - 1):
            v = Vector(((ps[i + 1].x - ps[i].x) / dt, (ps[i + 1].y - ps[i].y) / dt))
            if ps[i].z < zmin + PLANTED and v.length < 4.0:
                out.append(v)
    return out


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("street", "env.hdr"), strength=1.0, rotation_deg=float(ctx.P("hdri_rot")))
    C.shadow_catcher(size=60)
    root = ctx.asset("rb_woman")
    bpy.ops.import_scene.fbx(filepath=os.path.join(root, "Export", "Female_Adult_05.fbx"))
    rig = next(o for o in bpy.context.selected_objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.selected_objects if o.type == "MESH")
    for o in list(bpy.context.selected_objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o)
    mesh.animation_data_clear()
    C.rocketbox_skin(mesh, os.path.join(root, "Textures"))
    anchor = bpy.data.objects.new("anchor", None); bpy.context.collection.objects.link(anchor)
    src, act = C.drive_biped(rig, os.path.join(ctx.asset("walk"), "f_walk_neutral.max.fbx"), anchor)
    # the capture carries its forward travel on the armature object: keep its height, drop x/y, so the cycle is in
    # place and can repeat; the travel is then re-solved from the planted feet below
    for fc in _fcurves(act):
        if fc.data_path == "location" and fc.array_index in (0, 1):
            first = fc.keyframe_points[0].co[1]
            for k in fc.keyframe_points:
                k.co[1] = first; k.handle_left[1] = first; k.handle_right[1] = first
    # cycle the walk: an NLA strip repeated over the shot
    slot = src.animation_data.action_slot
    track = src.animation_data.nla_tracks.new()
    strip = track.strips.new("walk", 1, act)
    if slot is not None:
        strip.action_slot = slot
    cyc = act.frame_range[1] - act.frame_range[0]
    strip.repeat = math.ceil(ctx.frames / cyc) + 1
    src.animation_data.action = None
    # feet on the street, then the forward speed from the planted feet
    def lowest() -> float:
        ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh()
        z = min((ev.matrix_world @ v.co).z for v in me.vertices); ev.to_mesh_clear()
        return z
    low = 0.0
    for f in range(1, int(cyc) + 1, 2):
        bpy.context.scene.frame_set(f); low = min(low, lowest())
    anchor.location.z = -low
    planted = stance_velocities(ctx, rig, int(min(ctx.frames, 3 * cyc)))
    med = lambda xs: sorted(xs)[len(xs) // 2]
    back = Vector((med([v.x for v in planted]), med([v.y for v in planted])))   # planted feet slide backwards in place
    fwd = -back.normalized(); v_solved = back.length
    v = v_solved if ctx.P("speed") == "solved" else float(ctx.P("fixed_speed"))
    slide = lambda vv: sorted((p + fwd * vv).length for p in planted)            # foot speed over the ground
    def stats(vv):
        xs = slide(vv); return {"mean": round(100 * sum(xs) / len(xs), 1), "p90": round(100 * xs[int(.9 * len(xs))], 1)}
    cap = 1.552 / (36 / 24)                                       # the capture's own travel: 1.552 m over its 36-frame cycle
    globals()["_INFO"] = {"capture_travel_m_s": round(cap, 3), "slide_capture_speed_cm_s": stats(cap), "speed_solved_m_s": round(v_solved, 3), "speed_used_m_s": round(v, 3), "heading": [round(fwd.x, 3), round(fwd.y, 3)],
                          "cycle_frames": round(cyc, 1), "stance_samples": len(planted),
                          "slide_solved_cm_s": stats(v_solved), "slide_fixed_cm_s": {"fixed_speed": float(ctx.P("fixed_speed")), **stats(float(ctx.P("fixed_speed")))}}
    # the camera stands in the street ahead of her and only turns to follow her as she walks towards it. A camera
    # that only rotates is consistent with an environment map at infinity; one that travels needs parallax the HDRI
    # cannot give, and walking across the frame put her over the cars parked next to where the HDRI was shot.
    dur = (ctx.frames - 1) / ctx.fps
    start = -fwd * float(ctx.P("approach"))                     # she starts this far before the end of the walk
    for f in (1, ctx.frames):
        d = start + fwd * v * (f - 1) / ctx.fps
        anchor.location.x, anchor.location.y = d.x, d.y
        anchor.keyframe_insert("location", frame=f)
    for k in _keys(anchor):
        k.interpolation = "LINEAR"
    end = start + fwd * v * dur
    pos = (end.x + fwd.x * float(ctx.P("stop_short")) + 0.35, end.y + fwd.y * float(ctx.P("stop_short")), 1.45)
    look = lambda d: (d.x, d.y, 1.05)
    cam = C.camera([(1, pos, look(start)), (ctx.frames, pos, look(end))], lens=float(ctx.P("lens")), fstop=float(ctx.P("fstop")))
    cam.data.dof.focus_object = anchor
    for o in [cam, *[c.target for c in cam.constraints if getattr(c, "target", None)]]:
        if o.animation_data and o.animation_data.action:
            for k in _keys(o):
                k.interpolation = "LINEAR"
    print("C2V street", globals()["_INFO"])


def _fcurves(act: bpy.types.Action):
    """F-curves of an action (layered actions in Blender 4.4+, legacy before)."""
    if hasattr(act, "layers") and act.layers:
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    yield from bag.fcurves
    else:
        yield from act.fcurves


def _keys(o: bpy.types.Object):
    """Keyframe points of an object's action (layered actions in Blender 4.4+, legacy fcurves before)."""
    act = o.animation_data.action
    if hasattr(act, "layers") and act.layers:
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        yield from fc.keyframe_points
    else:
        for fc in act.fcurves:
            yield from fc.keyframe_points


def measure(ctx: C.Ctx) -> dict:
    """Walking speed solved from the stance feet, and the foot slide it leaves (vs a fixed speed)."""
    return globals().get("_INFO", {})
