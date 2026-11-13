"""film-cafe: two people at a café table, from code and libraries only.

People: Microsoft Rocketbox avatars (Female_Adult_05, Male_Adult_08; MIT) driven by Rocketbox motion-captured sitting
animations through C.drive_biped (world-rotation retargeting: the animation files are bound in a different pose).
Set: Poly Haven scans (CC0) - the table and the tea set / fruit in the layout solved in projects/pc-still
(table_layout.json: size priors, supports, no interpenetration, Bullet-settled), dining chairs, comfy_cafe HDRI.
Each chair is scaled so its seat meets the sitter's measured underside; each person is moved back from the table
until no vertex of theirs is inside it. Three shots, cut by camera markers: wide, over his shoulder onto her, reverse.
measure() reports person-table / person-chair interpenetration, seat and floor gaps over the shot.
"""
from __future__ import annotations

import importlib.util
import json
import math
import os

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import c2v_bpy as C

PARAMS = {"key": [0.25, 0.2], "fstop": 2.0, "cut1": 3.0, "cut2": 6.5, "naive": False}
HERE = os.path.dirname(os.path.abspath(__file__))
SEAT = 0.452                                    # dining_chair_02 cushion top at its centre, from vertical ray probes
PEOPLE = [  # name, asset, fbx, animation, x, y, yaw° (avatars face -Y)
    ("woman", "rb_woman", "Female_Adult_05", "f_sit_chair_gestic_thoughtful", -0.06, -0.62, 180),
    ("man", "rb_man", "Male_Adult_08", "m_sit_chair_gestic_thoughtful", 0.08, 0.62, 0),
]


def _still_module():
    spec = importlib.util.spec_from_file_location("pc_still", os.path.join(HERE, "..", "..", "pc-still", "blender", "still.py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def _bvh(o: bpy.types.Object, evaluated: bool = False) -> BVHTree:
    if evaluated:
        ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh()
        t = BVHTree.FromPolygons([ev.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons]); ev.to_mesh_clear()
        return t
    mw = o.matrix_world
    return BVHTree.FromPolygons([mw @ v.co for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons])


def _verts(o: bpy.types.Object) -> list[Vector]:
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh()
    out = [ev.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear()
    return out


def _inside(tree: BVHTree, pts: list[Vector], far: float = 0.05) -> tuple[int, float]:
    n, deep = 0, 0.0
    for p in pts:
        hit = tree.find_nearest(p, far)
        if hit[0] is not None and (p - hit[0]).dot(hit[1]) < 0 and hit[3] > 0.002:
            n += 1; deep = max(deep, hit[3])
    return n, deep


def person(ctx: C.Ctx, spec: tuple) -> dict:
    name, asset, fbx, anim, x, y, yaw = spec
    root = ctx.asset(asset)
    bpy.ops.import_scene.fbx(filepath=os.path.join(root, "Export", fbx + ".fbx"))
    rig = next(o for o in bpy.context.selected_objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.selected_objects if o.type == "MESH")
    for o in list(bpy.context.selected_objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o)
    mesh.animation_data_clear()
    C.rocketbox_skin(mesh, os.path.join(root, "Textures"))
    anchor = bpy.data.objects.new(f"anchor_{name}", None); bpy.context.collection.objects.link(anchor)
    anchor.location = (x, y, 0); anchor.rotation_euler = (0, 0, math.radians(yaw))
    C.drive_biped(rig, os.path.join(ctx.asset("anims"), anim + ".max.fbx"), anchor)
    return {"name": name, "rig": rig, "mesh": mesh, "anchor": anchor, "yaw": yaw}


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("cafe", "env.hdr"), strength=1.0, rotation_deg=200)
    still = _still_module()
    table, objs = still.load(ctx)
    saved = json.load(open(os.path.join(HERE, "table_layout.json")))
    for k, m in saved["matrices"].items():
        objs[k].matrix_world = Matrix([m[i * 4:(i + 1) * 4] for i in range(4)])
    for k in ("vase", "bottle_a", "bottle_b"):
        bpy.data.objects.remove(objs.pop(k))
    bpy.context.view_layer.update()
    top = still.world_bbox(table)[1].z
    floor = C.pbr_material("floor", color=(0.28, 0.2, 0.14), roughness=0.45)
    bpy.ops.mesh.primitive_plane_add(size=12); bpy.context.active_object.data.materials.append(floor)
    people = [person(ctx, p) for p in PEOPLE]
    mid = int(ctx.frames * 0.5)
    bpy.context.scene.frame_set(mid)
    table_tree = _bvh(table)
    report = {}
    for pp in people:
        # back away from the table until no vertex of the person is inside it (checked at three moments of the take)
        back = Vector((0, -1, 0)) if pp["yaw"] == 180 else Vector((0, 1, 0))
        moved = 0.0
        for _ in range(40):
            worst = 0
            for f in (1, mid, ctx.frames):
                bpy.context.scene.frame_set(f)
                worst = max(worst, _inside(table_tree, _verts(pp["mesh"]))[0])
            if worst == 0:
                break
            pp["anchor"].location += back * 0.01; moved += 0.01
        # feet on the floor: lift the performance by its lowest point over the take
        low = min(min(p.z for p in _verts(pp["mesh"])) for f in (1, mid, ctx.frames) if not bpy.context.scene.frame_set(f))
        if not ctx.P("naive"):                                     # naive: performance left where the file puts it
            pp["anchor"].location.z -= low
        bpy.context.scene.frame_set(mid); bpy.context.view_layer.update()
        # the chair: scaled so its seat top meets the sitter's underside, then slid along the back direction to the
        # offset with the fewest person vertices inside it (ties: smallest seat gap)
        rig = pp["rig"].evaluated_get(bpy.context.evaluated_depsgraph_get())
        pel = rig.matrix_world @ rig.pose.bones["Bip01 Pelvis"].head
        vs = _verts(pp["mesh"])
        under = min((p.z for p in vs if abs(p.x - pel.x) < 0.12 and abs(p.y - pel.y) < 0.12 and p.z > 0.25), default=0.45)
        bpy.ops.import_scene.gltf(filepath=ctx.asset("chair", "dining_chair_02_1k.gltf"))
        chair = next(o for o in bpy.context.selected_objects if o.type == "MESH")
        s = 1.0 if ctx.P("naive") else (under - 0.002) / SEAT       # seat cushion top of the model (probed by rays)
        best = None
        for k in ([0] if ctx.P("naive") else range(-6, 13)):
            d = 0.01 * k
            chair.matrix_world = (Matrix.Translation(Vector((pel.x, pel.y, 0)) + back * d) @ Matrix.Rotation(math.radians(pp["yaw"]), 4, "Z") @ Matrix.Scale(s, 4))
            bpy.context.view_layer.update()
            ct = _bvh(chair); n = _inside(ct, vs)[0]
            hit = ct.ray_cast(Vector((pel.x, pel.y, under + 0.1)), Vector((0, 0, -1)), 0.4)
            gap = abs(under - hit[0].z) if hit[0] else 1.0
            key = (n, round(gap, 3))
            if best is None or key < best[0]:
                best = (key, d)
        d = best[1]
        chair.matrix_world = (Matrix.Translation(Vector((pel.x, pel.y, 0)) + back * d) @ Matrix.Rotation(math.radians(pp["yaw"]), 4, "Z") @ Matrix.Scale(s, 4))
        pp["chair"] = chair
        report[pp["name"]] = {"moved_back_cm": round(100 * moved), "lifted_mm": round(-1000 * low, 1), "underside_m": round(under, 3),
                              "chair_scale": round(s, 3), "chair_offset_cm": round(100 * d)}
    bpy.context.view_layer.update()
    # light and cameras
    C.area_light((-1.8, -1.2, 2.2), (0, 0, 1.0), power=220, size=1.6, color=(1.0, 0.86, 0.7))
    head = lambda pp: (lambda r: r.matrix_world @ r.pose.bones["Bip01 Head"].head)(pp["rig"].evaluated_get(bpy.context.evaluated_depsgraph_get()))
    hw, hm = head(people[0]), head(people[1])
    def cam(name, loc, look, lens, focus):
        c = bpy.data.objects.new(name, bpy.data.cameras.new(name)); bpy.context.collection.objects.link(c)
        c.location = loc; c.data.lens = lens; c.data.clip_end = 200
        d = Vector(look) - Vector(loc); c.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        c.data.dof.use_dof = True; c.data.dof.aperture_fstop = float(ctx.P("fstop")); c.data.dof.focus_distance = (Vector(focus) - Vector(loc)).length
        return c
    wide = cam("wide", (1.9, -1.15, 1.35), (0.0, 0.0, 0.95), 32, (0.0, 0.0, 0.95))
    ots = cam("ots_her", hm + Vector((0.32, 0.38, 0.06)), hw + Vector((0, 0, -0.04)), 55, hw)
    rev = cam("ots_him", hw + Vector((-0.30, -0.38, 0.06)), hm + Vector((0, 0, -0.04)), 55, hm)
    scene = bpy.context.scene
    for f, c in ((1, wide), (int(ctx.P("cut1") * ctx.fps) + 1, ots), (int(ctx.P("cut2") * ctx.fps) + 1, rev)):
        mk = scene.timeline_markers.new(c.name, frame=f); mk.camera = c
    scene.camera = wide
    globals()["_STATE"] = {"people": people, "table": table, "report": report}
    print("C2V cafe", report)


def measure(ctx: C.Ctx) -> dict:
    """Interpenetration of each person with the table and their chair, and seat / floor gaps, every 12 frames."""
    st = globals().get("_STATE"); scene = bpy.context.scene
    out = {}
    for pp in st["people"]:
        tt, ct = _bvh(st["table"]), _bvh(pp["chair"])
        pen_t, pen_c, seat, floor = 0, 0, [], []
        for f in range(1, ctx.frames + 1, 12):
            scene.frame_set(f)
            vs = _verts(pp["mesh"])
            pen_t = max(pen_t, _inside(tt, vs)[0]); pen_c = max(pen_c, _inside(ct, vs)[0])
            r = pp["rig"].evaluated_get(bpy.context.evaluated_depsgraph_get()); pel = r.matrix_world @ r.pose.bones["Bip01 Pelvis"].head
            under = min((p.z for p in vs if abs(p.x - pel.x) < 0.12 and abs(p.y - pel.y) < 0.12 and p.z > 0.25), default=0)
            hit = ct.ray_cast(Vector((pel.x, pel.y, under + 0.1)), Vector((0, 0, -1)), 0.4)
            seat.append(round(1000 * (under - hit[0].z), 1) if hit[0] else None)       # negative: sunk into the cushion
            floor.append(round(1000 * min(p.z for p in vs), 1))
        seat_ok = [x for x in seat if x is not None]
        out[pp["name"]] = {**st["report"][pp["name"]], "table_penetrating_vertices_max": pen_t, "chair_penetrating_vertices_max": pen_c,
                           "seat_gap_mm": {"min": min(seat_ok, default=None), "max": max(seat_ok, default=None)},
                           "lowest_point_above_floor_mm": {"min": min(floor), "max": max(floor)}}
    return out
