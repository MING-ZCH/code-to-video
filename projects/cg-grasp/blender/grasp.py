"""cg-grasp: interaction realism. A photo-textured hand (Microsoft Rocketbox, MIT) picks up a scanned teacup
(Poly Haven tea_set_01, CC0) from a scanned table, seated, in an interior HDRI.

Both variants share the wrist path, the palm orientation and the timing; they differ only in how the fingers close:
  grip = "canned": every finger joint turns by a fixed angle (a stock grip pose), as a keyframed or retrieved pose would;
  grip = "solved": the open hand is first moved out of the cup's volume (convex hull) along the hull normals; then each
                   joint, proximal first, turns toward the cup until its part of the finger is within ``contact_mm`` of
                   the hull without entering it (signed distance to a BVH of the hull).
The cup is attached to the hand only when the fingers have closed, and follows the hand bone exactly afterwards.
measure() reports, over the frames the cup is held, how deep and how many hand vertices are inside the porcelain (wall)
and inside the cup's volume (convex hull: the mouth closed), the fingertip gaps, and the cup-table gap before the lift: the quantities that make a grasp read as real or not.
"""
from __future__ import annotations

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

import c2v_bpy as C

PARAMS = {"grip": "solved", "canned_deg": [55, 65, 45], "contact_mm": 2.0, "seat_drop": 0.25}

PERSON = Vector((0.13, 0.50, 0.0))                     # stands (sits) behind the table edge at y = 0.353, facing −Y
CUP_AT = Vector((-0.05, 0.20, 0.0))                    # z is set to the table top
FINGERS = [[f"Bip01 R Finger{k}", f"Bip01 R Finger{k}1", f"Bip01 R Finger{k}2"] for k in range(5)]
HAND_GROUPS = {"Bip01 R Hand", *[b for f in FINGERS for b in f]}
TIMES = {"pre": 1.6, "grasp": 2.3, "closed": 2.9, "lifted": 4.4}


def _photo_skin(name: str, tex_dir: str, prefix: str, alpha: str | None = None) -> bpy.types.Material:
    """Avatar skin from its photographic colour / normal / specular maps, with subsurface scattering."""
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
    def tex(file: str, non_color: bool) -> bpy.types.Node:
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.join(tex_dir, file), check_existing=True)
        if non_color:
            n.image.colorspace_settings.name = "Non-Color"
        return n
    col = tex(f"{prefix}_color.tga", False)
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha:
        nt.links.new(col.outputs["Alpha"], bsdf.inputs["Alpha"])
        return mat
    nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(tex(f"{prefix}_normal.tga", True).outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(tex(f"{prefix}_specular.tga", True).outputs["Color"], bsdf.inputs["Specular IOR Level"])
    bsdf.inputs["Roughness"].default_value = 0.45
    bsdf.inputs["Subsurface Weight"].default_value = 0.25
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2)
    bsdf.inputs["Subsurface Scale"].default_value = 0.006
    return mat


def person(ctx: C.Ctx) -> tuple[bpy.types.Object, bpy.types.Object]:
    """Import the avatar (rig, mesh), clear the FBX take, apply photo skin, seat it behind the table."""
    root = ctx.asset("rb_person")
    bpy.ops.import_scene.fbx(filepath=os.path.join(root, "Export", "Sports_Female_02.fbx"))
    rig = next(o for o in bpy.context.selected_objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.selected_objects if o.type == "MESH")
    for o in list(bpy.context.selected_objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o)
    mesh.animation_data_clear()
    tex = os.path.join(root, "Textures")
    for i, m in enumerate(mesh.data.materials):
        part = "opacity" if "opacity" in m.name else "head" if "head" in m.name else "body"
        mesh.data.materials[i] = _photo_skin(f"skin_{part}", tex, f"f013_{part}", alpha="hair" if part == "opacity" else None)
    C.fix_biped_tails(rig)
    rig.location += PERSON + Vector((0, 0, -float(ctx.P("seat_drop"))))  # seated height; legs stay below the frame
    bpy.context.view_layer.update()
    return rig, mesh


def tea_set(ctx: C.Ctx, top: float) -> tuple[bpy.types.Object, Vector]:
    """The teacup on the table with its handle away from the hand (+X); teapot, sugar bowl and a plate beside it."""
    bpy.ops.import_scene.gltf(filepath=ctx.asset("tea", "tea_set_01_2k.gltf"))   # keeps the set's layout
    objs = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    keep = {"cup_small_01", "teapot_01", "teapot_01_lid", "sugar_cup_01", "sugar_cup_01_lid", "plate_large_circular_03"}
    by = {o.name.replace("tea_set_01_", ""): o for o in objs}
    for k, o in list(by.items()):
        if k not in keep:
            bpy.data.objects.remove(o); del by[k]
    cup = by["cup_small_01"]
    bpy.context.view_layer.update()
    ws = [cup.matrix_world @ v.co for v in cup.data.vertices]
    xmin, xmax = min(p.x for p in ws), max(p.x for p in ws)
    r_top = (xmax - xmin) / 2
    c = Vector(((xmin + xmax) / 2, min(p.y for p in ws) + r_top, min(p.z for p in ws)))     # body axis at the bottom
    target = Vector((CUP_AT.x, CUP_AT.y, top))
    rot = Matrix.Rotation(-math.pi / 2, 4, "Z")                   # handle +Y → +X
    for o in by.values():
        mw = o.matrix_world.copy()
        o.parent = None
        if o is cup:
            o.matrix_world = Matrix.Translation(target) @ rot @ Matrix.Translation(-c) @ mw
        else:                                                      # the rest of the set turned 180° about the cup
            o.matrix_world = Matrix.Translation(target) @ Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Translation(-c) @ mw
    bpy.context.view_layer.update()
    return cup, target


def cup_radius(cup: bpy.types.Object, axis: Vector, z0: float, z1: float) -> float:
    """Outer body radius of the cup between heights z0..z1 (world) on the side away from the handle (x < axis)."""
    band = [p for p in (cup.matrix_world @ v.co for v in cup.data.vertices) if z0 <= p.z <= z1 and p.x <= axis.x]
    return max(math.hypot(p.x - axis.x, p.y - axis.y) for p in band)


def _hand_verts(mesh: bpy.types.Object) -> dict[str, list[int]]:
    """Vertex indices by their dominant hand/finger bone."""
    names = {g.index: g.name for g in mesh.vertex_groups}
    out: dict[str, list[int]] = {}
    for v in mesh.data.vertices:
        if not v.groups:
            continue
        g = max(v.groups, key=lambda e: e.weight)
        n = names[g.group]
        if n in HAND_GROUPS:
            out.setdefault(n, []).append(v.index)
    return out


def _world_verts(mesh: bpy.types.Object, idx: list[int]) -> list[Vector]:
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg); me = ev.to_mesh()
    out = [ev.matrix_world @ me.vertices[i].co for i in idx]
    ev.to_mesh_clear()
    return out


def _cup_bvh(cup: bpy.types.Object, hull: bool = False) -> BVHTree:
    """BVH of the cup in world space: its wall mesh, or (hull=True) its convex hull, i.e. the cup with the mouth closed,
    since a finger inside a cup of tea is as wrong as a finger inside the porcelain."""
    mw = cup.matrix_world
    if not hull:
        return BVHTree.FromPolygons([mw @ v.co for v in cup.data.vertices], [tuple(p.vertices) for p in cup.data.polygons])
    bm = bmesh.new()
    for v in cup.data.vertices:
        bm.verts.new(mw @ v.co)
    out = bmesh.ops.convex_hull(bm, input=bm.verts)
    drop = {g for g in out["geom_interior"] + out["geom_unused"] if isinstance(g, bmesh.types.BMVert)}
    bmesh.ops.delete(bm, geom=list(drop), context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    tree = BVHTree.FromBMesh(bm); bm.free()
    return tree


def _signed(bvh: BVHTree, p: Vector, far: float = 0.03) -> float:
    """Signed distance to the cup surface (negative inside the wall), or ``far`` if nothing is within it."""
    hit = bvh.find_nearest(p, far)
    if hit[0] is None:
        return far
    loc, nrm, _, dist = hit
    return dist if (p - loc).dot(nrm) >= 0 else -dist


def _rotate_world(rig: bpy.types.Object, pb: bpy.types.PoseBone, axis_w: Vector, ang: float) -> None:
    """Turn a pose bone by ``ang`` about a world axis through its head (bone axes from FBX Biped are not reliable)."""
    a = (rig.matrix_world.inverted().to_3x3() @ axis_w).normalized()
    m = pb.matrix.copy(); h = m.translation.copy()
    pb.matrix = Matrix.Translation(h) @ Quaternion(a, ang).to_matrix().to_4x4() @ Matrix.Translation(-h) @ m
    bpy.context.view_layer.update()


def close_fingers(ctx: C.Ctx, rig, mesh, cup, axis_pt: Vector, r: float) -> dict:
    """Close each finger toward the cup axis; 'solved' stops at contact, 'canned' turns fixed angles. Returns per-bone quats."""
    groups = _hand_verts(mesh); bvh = _cup_bvh(cup, hull=True)
    for chain in FINGERS:
        for bn in chain:
            rig.pose.bones[bn].rotation_mode = "QUATERNION"
    eps, step = float(ctx.P("contact_mm")) / 1000, math.radians(1.5)
    canned = [math.radians(a) for a in ctx.P("canned_deg")]
    log = {}
    for fi, chain in enumerate(FINGERS):
        for j, bn in enumerate(chain):
            pb = rig.pose.bones[bn]
            below = [i for b in chain[j:] for i in groups.get(b, [])]      # this segment and everything distal to it
            if not below:
                continue
            head = rig.matrix_world @ pb.head
            vs = _world_verts(mesh, below)
            tip = max(vs, key=lambda v: (v - head).length)
            seg = (tip - head).normalized()
            if fi == 0:                                            # the thumb opposes the fingers on the near side
                to_cup = axis_pt + Vector((-0.2 * r, 0.9 * r, 0.035)) - head
            else:                                                  # fingers wrap horizontally toward the axis
                to_cup = Vector((axis_pt.x - head.x, axis_pt.y - head.y, 0.0))
            axis = seg.cross(to_cup)
            if axis.length < 1e-6:
                continue
            axis.normalize()
            if ctx.P("grip") == "canned":
                _rotate_world(rig, pb, axis, canned[j] * (0.6 if fi == 0 else 1.0))
                log[bn] = round(math.degrees(canned[j] * (0.6 if fi == 0 else 1.0)), 1)
                continue
            turned = 0.0
            while turned < math.radians(100):
                d = min(_signed(bvh, v) for v in _world_verts(mesh, below))
                if d <= eps:
                    break
                _rotate_world(rig, pb, axis, step); turned += step
            while min(_signed(bvh, v) for v in _world_verts(mesh, below)) < -0.0005 and turned > 0:
                _rotate_world(rig, pb, axis, -step / 3); turned -= step / 3     # back out of the wall
            log[bn] = round(math.degrees(turned), 1)
    quats = {}
    for chain in FINGERS:
        for bn in chain:
            pb = rig.pose.bones[bn]; pb.rotation_mode = "QUATERNION"; quats[bn] = pb.rotation_quaternion.copy()
    return {"quats": quats, "deg": log}


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("room", "env.hdr"), strength=1.0, rotation_deg=120)
    _, tbl = C.import_gltf(ctx.asset("table", "wooden_table_02_2k.gltf"))
    bpy.context.view_layer.update()
    top = max((o.matrix_world @ v.co).z for o in tbl for v in o.data.vertices)
    floor = C.pbr_material("floor", color=(0.32, 0.26, 0.2), roughness=0.55)
    bpy.ops.mesh.primitive_plane_add(size=12); bpy.context.active_object.data.materials.append(floor)
    cup, axis_pt = tea_set(ctx, top)
    rig, mesh = person(ctx)
    r = cup_radius(cup, axis_pt, top + 0.025, top + 0.05)
    grasp_h = top + 0.030
    fr = lambda s: int(round(s * ctx.fps)) + 1

    # hand orientation: palm toward +X (the cup), fingers forward and a little down, index on top
    pb_h = rig.pose.bones["Bip01 R Hand"]
    W = lambda b: rig.matrix_world @ rig.pose.bones[b].head
    H, I, P_, M = W("Bip01 R Hand"), W("Bip01 R Finger1"), W("Bip01 R Finger4"), W("Bip01 R Finger2")
    f0 = (M - H).normalized(); lat = (I - P_).normalized()
    p0 = lat.cross(f0).normalized()
    if p0.x < 0:
        p0 = -p0
    p0 = (p0 - f0 * p0.dot(f0)).normalized(); s0 = f0.cross(p0)
    f1 = Vector((0.0, -1.0, -0.12)).normalized(); p1 = Vector((1.0, 0.0, 0.0)); p1 = (p1 - f1 * p1.dot(f1)).normalized(); s1 = f1.cross(p1)
    Rm = Matrix((f1, p1, s1)).transposed() @ Matrix((f0, p0, s0))
    rest_rot = (rig.matrix_world @ pb_h.bone.matrix_local).to_3x3().normalized()
    rot_e = bpy.data.objects.new("hand_rot", None); bpy.context.collection.objects.link(rot_e); rot_e.rotation_mode = "QUATERNION"
    q_rest, q_grasp = rest_rot.to_quaternion(), (Rm @ rest_rot).to_quaternion()
    palm0 = (H + I + P_ + M) / 4 + p0 * 0.012
    goal = Vector((axis_pt.x - r - 0.004, axis_pt.y + 0.012, grasp_h))
    wrist_grasp = goal - Rm @ (palm0 - H)
    tgt = bpy.data.objects.new("wrist_tgt", None); bpy.context.collection.objects.link(tgt)
    def key_path(w: Vector) -> None:
        tgt.animation_data_clear(); rot_e.animation_data_clear()
        keys = [(fr(0.0), H + Vector((0.02, -0.05, 0.06)), q_rest), (fr(TIMES["pre"]), w + Vector((-0.07, 0.03, 0.03)), q_grasp),
                (fr(TIMES["grasp"]), w, q_grasp), (fr(TIMES["closed"]), w, q_grasp),
                (fr(TIMES["lifted"]), w + Vector((0.0, 0.07, 0.14)), q_grasp), (ctx.frames, w + Vector((0.0, 0.08, 0.15)), q_grasp)]
        for f, loc, q in keys:
            tgt.location = loc; tgt.keyframe_insert("location", frame=f)
            rot_e.rotation_quaternion = q; rot_e.keyframe_insert("rotation_quaternion", frame=f)
    key_path(wrist_grasp)
    pole = bpy.data.objects.new("elbow_pole", None); bpy.context.collection.objects.link(pole); pole.location = H + Vector((-0.45, 0.25, -0.05))
    ik = rig.pose.bones["Bip01 R Forearm"].constraints.new("IK"); ik.target = tgt; ik.pole_target = pole; ik.chain_count = 2; ik.pole_angle = math.radians(-90)
    cr = pb_h.constraints.new("COPY_ROTATION"); cr.target = rot_e
    # placement: with the fingers open, move the wrist out along the hull normals until no part of the hand is in the cup
    hull, hand_idx, shift = _cup_bvh(cup, hull=True), [i for v in _hand_verts(mesh).values() for i in v], Vector()
    if ctx.P("grip") == "solved":
        for _ in range(60):
            bpy.context.scene.frame_set(fr(TIMES["grasp"]))
            push, worst = Vector(), 0.0
            for v in _world_verts(mesh, hand_idx):
                hit = hull.find_nearest(v, 0.06)
                if hit[0] is not None and (v - hit[0]).dot(hit[1]) < 0:
                    push += hit[1] * hit[3]; worst = max(worst, hit[3])
            if worst < 0.0005:
                break
            step = push.normalized() * min(0.003, worst + 0.0005)
            shift += step; key_path(wrist_grasp + shift)
    wrist_grasp = wrist_grasp + shift

    # close the fingers at the grasp pose, then key: open until "grasp", closed by "closed"
    bpy.context.scene.frame_set(fr(TIMES["grasp"]))
    solved = close_fingers(ctx, rig, mesh, cup, axis_pt, r)
    for bn, q in solved["quats"].items():
        pb = rig.pose.bones[bn]
        pb.rotation_quaternion = Quaternion(); pb.keyframe_insert("rotation_quaternion", frame=fr(TIMES["grasp"]))
        pb.rotation_quaternion = q; pb.keyframe_insert("rotation_quaternion", frame=fr(TIMES["closed"]))
    # the cup follows the hand bone from the moment the fingers have closed
    cup.rotation_mode = "QUATERNION"
    f_att = fr(TIMES["closed"])
    bone_w = lambda: rig.matrix_world @ rig.pose.bones["Bip01 R Hand"].matrix
    bpy.context.scene.frame_set(f_att)
    rel = bone_w().inverted() @ cup.matrix_world
    cup.keyframe_insert("location", frame=f_att - 1); cup.keyframe_insert("rotation_quaternion", frame=f_att - 1)
    for f in range(f_att, ctx.frames + 1):
        bpy.context.scene.frame_set(f)
        m = bone_w() @ rel
        cup.location = m.translation; cup.rotation_quaternion = m.to_quaternion()
        cup.keyframe_insert("location", frame=f); cup.keyframe_insert("rotation_quaternion", frame=f)
    C.area_light((0.9, -0.6, 1.9), (axis_pt.x, axis_pt.y, top), power=120, size=1.2)
    look0, look1 = Vector((axis_pt.x - 0.03, axis_pt.y + 0.03, top + 0.07)), Vector((axis_pt.x - 0.03, axis_pt.y + 0.08, top + 0.15))
    C.camera([(1, (0.42, -0.40, 1.02), look0), (fr(TIMES["closed"]), (0.40, -0.38, 1.02), look0), (ctx.frames, (0.42, -0.36, 1.10), look1)], lens=45, fstop=4.0)
    bpy.context.scene["c2v_grasp"] = {"deg": solved["deg"], "r": r, "top": top, "placement_shift_mm": [round(1000 * x, 1) for x in shift]}
    print("C2V grasp", ctx.P("grip"), solved["deg"], "cup r", round(r, 4))


def measure(ctx: C.Ctx) -> dict:
    """Contact quality over the held frames: hand-in-cup depth, penetrating vertices, fingertip gaps; cup-table gap."""
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    mesh = next(o for o in scene.objects if o.type == "MESH" and o.parent is rig)
    cup = next(o for o in scene.objects if o.name.endswith("cup_small_01"))
    groups = _hand_verts(mesh)
    hand = [i for v in groups.values() for i in v]
    tips = {f[2]: groups.get(f[2], []) for f in FINGERS}
    fr = lambda s: int(round(s * ctx.fps)) + 1
    depth, count, hdepth, hcount, tipgap = [], [], [], [], []
    for f in range(fr(TIMES["closed"]), ctx.frames + 1, 3):
        scene.frame_set(f)
        bvh, hull = _cup_bvh(cup), _cup_bvh(cup, hull=True)
        vs = _world_verts(mesh, hand)
        for tree, dd, cc in ((bvh, depth, count), (hull, hdepth, hcount)):
            inside = [-x for x in (_signed(tree, v, 0.06) for v in vs) if x < -0.0005]
            dd.append(max(inside) if inside else 0.0); cc.append(len(inside))
        for b, idx in tips.items():
            if idx:
                tipgap.append(min(abs(_signed(hull, v, 0.05)) for v in _world_verts(mesh, idx)))
    scene.frame_set(fr(TIMES["grasp"]))
    cup_bottom = min((cup.matrix_world @ v.co).z for v in cup.data.vertices)
    info = scene.get("c2v_grasp", {})
    mm = lambda x: round(1000 * x, 1)
    return {"grip": ctx.P("grip"), "held_frames_sampled": len(depth),
            "wall_penetration_mm": {"max": mm(max(depth)), "mean": mm(sum(depth) / len(depth))},
            "wall_penetrating_vertices": {"mean": round(sum(count) / len(count), 1), "max": max(count)},
            "in_cup_mm": {"max": mm(max(hdepth)), "mean": mm(sum(hdepth) / len(hdepth))},
            "in_cup_vertices": {"mean": round(sum(hcount) / len(hcount), 1), "max": max(hcount)},
            "fingertip_gap_mm": {"mean": mm(sum(tipgap) / len(tipgap)), "max": mm(max(tipgap))},
            "cup_table_gap_mm": mm(cup_bottom - info.get("top", cup_bottom)), "cup_body_radius_mm": mm(info.get("r", 0)),
            "placement_shift_mm": list(info.get("placement_shift_mm", [])), "joint_deg": dict(info.get("deg", {}))}
