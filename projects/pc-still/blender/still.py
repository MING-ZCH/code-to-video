"""pc-still: a tabletop still life from a CC0 scan library (Poly Haven), laid out by code, no capture.

layout = "naive":        each object's origin placed at its intended spot on the table or plate, as a script that
                         trusts pivots does; the fruit spots of the pile overlap.
layout = "naive_scaled": the same, with every asset normalised to a 20 cm largest side (a common fix for mixed-unit
                         libraries, which throws away the library's real scale).
layout = "solved":       1. scale check against category size priors (real-world ranges, in metres);
                         2. each mesh's lowest point put on its support (pivots are not bottoms: the lemon's origin is
                            its centre, 5.2 cm above its base);
                         3. table-top footprints pushed apart until no two overlap;
                         4. the fruit dropped onto the plate in pile order and the whole set settled by Bullet rigid
                            bodies (convex hulls, 0.5 mm margin; table, plate and saucer as passive meshes).
measure() runs the same physics probe on whichever layout was built (how far each object moves once gravity is on),
and reports pairwise interpenetration, support gaps under each object and size-prior violations.
params.export writes the built scene (camera included) to glTF for the three.js renderers.
"""
from __future__ import annotations

import math
import os

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import c2v_bpy as C

PARAMS = {"layout": "solved", "view": "agx", "export": "", "seed": 3, "settle_frames": 150, "camera": "hero", "denoise": True,
          "engine": "cycles", "reuse": True}

# name in the library → (asset, object name, intended x, y on the table (m), yaw°, support)
LAYOUT = [
    ("teapot", "tea", "tea_set_01_teapot_01", -0.25, 0.08, 35, "table"),
    ("teapot_lid", "tea", "tea_set_01_teapot_01_lid", -0.25, 0.08, 35, "teapot"),
    ("saucer", "tea", "tea_set_01_saucer_circular_04", -0.04, -0.17, 0, "table"),
    ("cup", "tea", "tea_set_01_cup_small_01", -0.04, -0.17, -60, "saucer"),
    ("plate", "tea", "tea_set_01_plate_large_circular_03", 0.13, 0.02, 0, "table"),
    ("pomegranate", "pomegranate", "food_pomegranate_01", 0.11, 0.04, 10, "plate"),
    ("apple", "apple", "food_apple_01", 0.10, -0.19, 50, "table"),
    ("lemon", "lemon", "lemon", 0.16, -0.02, 80, "plate"),
    ("pear_a", "pears", "food_pears_asian_01_a", 0.20, -0.13, 0, "table"),
    ("pear_c", "pears", "food_pears_asian_01_c", 0.25, -0.20, 0, "table"),
    ("vase", "vase", "antique_ceramic_vase_01", 0.40, 0.17, 0, "table"),
    ("bottle_a", "bottles", "wine_bottles_01_burgundy", 0.33, -0.13, 0, "table"),
    ("bottle_b", "bottles", "wine_bottles_01_champagne", 0.42, -0.06, 0, "table"),
    ("candle", "candles", "brass_candleholder_01", -0.44, -0.16, 0, "table"),
]
# category size priors: largest dimension in metres (generous real-world ranges)
SIZE_PRIOR = {"teapot": (0.12, 0.35), "teapot_lid": (0.05, 0.16), "saucer": (0.10, 0.20), "cup": (0.06, 0.14), "plate": (0.15, 0.32),
              "pomegranate": (0.06, 0.14), "apple": (0.06, 0.11), "lemon": (0.05, 0.12), "pear_a": (0.04, 0.14), "pear_c": (0.04, 0.14),
              "vase": (0.15, 0.70), "bottle_a": (0.20, 0.40), "bottle_b": (0.20, 0.40), "candle": (0.15, 0.50), "table": (0.6, 2.4)}
PASSIVE_MESH = {"plate", "saucer"}
FRUIT = ("pomegranate", "apple", "lemon", "pear_a", "pear_c")
ON_PLATE = ("pomegranate", "lemon")   # a 19 cm plate holds two of the three pieces side by side (the solver found
                                       # apple + pomegranate + lemon only fit stacked, and the stacked piece rolled off)


def world_bbox(o: bpy.types.Object) -> tuple[Vector, Vector]:
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    return Vector([min(p[i] for p in ws) for i in range(3)]), Vector([max(p[i] for p in ws) for i in range(3)])


def load(ctx: C.Ctx) -> tuple[bpy.types.Object, dict[str, bpy.types.Object]]:
    """Import the table and the library objects named in LAYOUT; delete everything else the files bring."""
    bpy.ops.import_scene.gltf(filepath=ctx.asset("table", "wooden_table_02_1k.gltf"))
    table = next(o for o in bpy.context.selected_objects if o.type == "MESH")
    objs, files = {}, {}
    for key, asset, obj_name, *_ in LAYOUT:
        if asset not in files:
            path = ctx.asset(asset)
            gltf = next(f for f in os.listdir(path) if f.endswith(".gltf"))
            bpy.ops.import_scene.gltf(filepath=os.path.join(path, gltf))
            files[asset] = {o.name: o for o in bpy.context.selected_objects}
        objs[key] = files[asset][obj_name]
    keep = {table, *objs.values()}
    for o in list(bpy.data.objects):
        if o.type in ("MESH", "EMPTY") and o not in keep:
            bpy.data.objects.remove(o)
    for o in keep:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.context.view_layer.update()
    return table, objs


def place(objs: dict, table: bpy.types.Object, layout: str) -> None:
    """Put every object at its intended spot (see module docstring); the lid keeps its seat on the pot."""
    top = world_bbox(table)[1].z
    rel_lid = objs["teapot"].matrix_world.inverted() @ objs["teapot_lid"].matrix_world
    for key, _, _, x, y, yaw, support in LAYOUT:
        if key == "teapot_lid":
            continue
        o = objs[key]
        lo, hi = world_bbox(o)
        if layout == "naive_scaled":
            o.matrix_world = Matrix.Scale(0.20 / max(hi - lo), 4) @ o.matrix_world
            bpy.context.view_layer.update(); lo, hi = world_bbox(o)
        centre = (lo + hi) / 2
        rot = Matrix.Rotation(math.radians(yaw), 4, "Z")
        if layout == "solved":
            sup = world_bbox(objs["saucer"])[1].z - 0.004 if support == "saucer" else top + (0.02 if support == "plate" else 0.0)
            o.matrix_world = Matrix.Translation(Vector((x, y, 0))) @ rot @ Matrix.Translation(Vector((-centre.x, -centre.y, 0))) @ o.matrix_world
            bpy.context.view_layer.update()
            o.matrix_world = Matrix.Translation(Vector((0, 0, sup - world_bbox(o)[0].z + 0.0005))) @ o.matrix_world
        else:                                                    # the origin is taken for the base
            sup = top + (0.018 if support == "plate" else 0.016 if support == "saucer" else 0.0)
            oz = o.matrix_world.translation.z
            o.matrix_world = Matrix.Translation(Vector((x, y, sup))) @ rot @ Matrix.Translation(Vector((-centre.x, -centre.y, -oz))) @ o.matrix_world
        bpy.context.view_layer.update()
    objs["teapot_lid"].matrix_world = objs["teapot"].matrix_world @ rel_lid
    bpy.context.view_layer.update()


def separate_footprints(objs: dict, table_lo: Vector, table_hi: Vector, iters: int = 200) -> int:
    """Push table-top footprints (circles) apart until none overlap, staying on the table. Returns moves made."""
    keys = [k for k, _, _, _, _, _, s in LAYOUT if s == "table"]
    group = {"teapot": ["teapot_lid"], "saucer": ["cup"], "plate": ["pomegranate", "lemon"]}
    moves = 0
    for _ in range(iters):
        moved = False
        circ = {}
        for k in keys:
            lo, hi = world_bbox(objs[k])
            circ[k] = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, max(hi.x - lo.x, hi.y - lo.y) / 2 + 0.01)
        for i, a in enumerate(keys):
            for b in keys[i + 1:]:
                ax, ay, ar = circ[a]; bx, by, br = circ[b]
                d = math.hypot(bx - ax, by - ay); need = ar + br - d
                if need > 0:
                    ux, uy = ((bx - ax) / d, (by - ay) / d) if d > 1e-6 else (1.0, 0.0)
                    for k, sgn in ((a, -0.5), (b, 0.5)):
                        t = Vector((ux * need * sgn, uy * need * sgn, 0))
                        for kk in [k, *group.get(k, [])]:
                            objs[kk].matrix_world = Matrix.Translation(t) @ objs[kk].matrix_world
                    moved = True; moves += 1
        for k in keys:                                           # keep footprints on the table
            lo, hi = world_bbox(objs[k])
            t = Vector((max(0, table_lo.x + 0.02 - lo.x) + min(0, table_hi.x - 0.02 - hi.x), max(0, table_lo.y + 0.02 - lo.y) + min(0, table_hi.y - 0.02 - hi.y), 0))
            if t.length > 0:
                for kk in [k, *group.get(k, [])]:
                    objs[kk].matrix_world = Matrix.Translation(t) @ objs[kk].matrix_world
        bpy.context.view_layer.update()
        if not moved:
            break
    return moves


def settle(ctx: C.Ctx, objs: dict, table: bpy.types.Object, frames: int, apply: bool) -> dict[str, tuple[float, float]]:
    """Run Bullet for ``frames``; return each object's displacement (mm) and rotation (deg); keep the result if ``apply``."""
    scene = bpy.context.scene
    start = {k: o.matrix_world.copy() for k, o in objs.items()}
    C.rigid(table, passive=True, shape="MESH", friction=0.8, bounce=0.05)
    table.rigid_body.collision_margin = 0.0005
    for k, o in objs.items():
        if k in PASSIVE_MESH:
            C.rigid(o, passive=True, shape="MESH", friction=0.7, bounce=0.05)
        else:
            fruit = k in FRUIT
            C.rigid(o, mass=max(0.05, 400 * (lambda lo, hi: (hi - lo).x * (hi - lo).y * (hi - lo).z)(*world_bbox(o))), friction=1.0 if fruit else 0.7,
                    bounce=0.02, shape="CONVEX_HULL", damping=(0.6, 0.95) if fruit else (0.3, 0.5))
        o.rigid_body.collision_margin = 0.0005
    C.physics_world(ctx, substeps=30, iterations=40)
    w = scene.rigidbody_world
    w.point_cache.frame_start, w.point_cache.frame_end = 1, frames
    track = []
    for f in range(1, frames + 1):
        scene.frame_set(f)
        pass
    end = {k: o.matrix_world.copy() for k, o in objs.items()}
    moved = {k: (round(1000 * (end[k].translation - start[k].translation).length, 1),
                 round(math.degrees(start[k].to_quaternion().rotation_difference(end[k].to_quaternion()).angle), 1)) for k in objs}
    for o in [table, *objs.values()]:
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.rigidbody.object_remove(); o.select_set(False)
    bpy.ops.rigidbody.world_remove()
    scene.frame_set(1)
    for k, o in objs.items():
        o.matrix_world = end[k] if apply else start[k]
    bpy.context.view_layer.update()
    return moved


def rest_on(objs: dict, key: str, below: list, table: bpy.types.Object) -> None:
    """Lower ``key`` until its lowest points are 2 mm above the first surface under them (plate, fruit or table)."""
    o = objs[key]; lo, hi = world_bbox(o)
    trees = [_bvh(b) for b in below] + [_bvh(table)]
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    drop = 1.0
    for p in pts[:: max(1, len(pts) // 300)]:
        for t in trees:
            hit = t.ray_cast(p, Vector((0, 0, -1)), 1.0)
            if hit[0] is not None:
                drop = min(drop, hit[3])
    if drop < 1.0:
        o.matrix_world = Matrix.Translation(Vector((0, 0, -(drop - 0.002)))) @ o.matrix_world
        bpy.context.view_layer.update()


def sweep_drop(o: bpy.types.Object, obstacles: list) -> float:
    """Lift ``o`` above all ``obstacles``, then lower it to first contact: the smaller of the downward rays from its
    vertices to the obstacles and the upward rays from the obstacles' vertices to it (a discrete vertical sweep)."""
    top = max(world_bbox(b)[1].z for b in obstacles)
    lo, hi = world_bbox(o)
    o.matrix_world = Matrix.Translation(Vector((0, 0, top + 0.01 - lo.z))) @ o.matrix_world
    bpy.context.view_layer.update()
    me = _bvh(o)
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    drop = 1.0
    for b in obstacles:
        tb = _bvh(b)
        for p in pts[:: max(1, len(pts) // 400)]:
            hit = tb.ray_cast(p, Vector((0, 0, -1)), 1.0)
            if hit[0] is not None:
                drop = min(drop, hit[3])
        bp = [b.matrix_world @ v.co for v in b.data.vertices]
        for q in bp[:: max(1, len(bp) // 400)]:
            hit = me.ray_cast(q, Vector((0, 0, 1)), 1.0)
            if hit[0] is not None:
                drop = min(drop, hit[3])
    o.matrix_world = Matrix.Translation(Vector((0, 0, -(drop - 0.001)))) @ o.matrix_world
    bpy.context.view_layer.update()
    return drop


def on_plate(objs: dict, key: str, pc: Vector, prad: float, top: float) -> bool:
    """Inside the plate's rim and not lying on the table (lowest point at least 3 mm above the table top)."""
    lo, hi = world_bbox(objs[key]); c = (lo + hi) / 2
    return math.hypot(c.x - pc.x, c.y - pc.y) < prad and lo.z > top + 0.003


def support_of(objs: dict, key: str, table: bpy.types.Object) -> str:
    """Name of the object directly under ``key``'s lowest point."""
    o = objs[key]; lo, hi = world_bbox(o)
    p = min((o.matrix_world @ v.co for v in o.data.vertices), key=lambda q: q.z)
    best, name = 1.0, "none"
    for k, b in {"table": table, **objs}.items():
        if k == key:
            continue
        hit = _bvh(b).ray_cast(p + Vector((0, 0, 0.001)), Vector((0, 0, -1)), 0.3)
        if hit[0] is not None and hit[3] < best:
            best, name = hit[3], k
    return name


def _bvh(o: bpy.types.Object) -> BVHTree:
    mw = o.matrix_world
    return BVHTree.FromPolygons([mw @ v.co for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons])


def contact_report(objs: dict, table: bpy.types.Object) -> dict:
    """Pairwise interpenetration (vertices of A inside B's shell) and the gap under each object's lowest points."""
    allo = {"table": table, **objs}
    trees = {k: _bvh(o) for k, o in allo.items()}
    boxes = {k: world_bbox(o) for k, o in allo.items()}
    verts = {k: [o.matrix_world @ v.co for v in o.data.vertices] for k, o in allo.items()}
    pen, pairs = {}, []
    for a in objs:
        for b, tb in trees.items():
            if a == b:
                continue
            (alo, ahi), (blo, bhi) = boxes[a], boxes[b]
            if any(ahi[i] < blo[i] or bhi[i] < alo[i] for i in range(3)):
                continue
            depth, n = 0.0, 0
            for p in verts[a]:
                hit = tb.find_nearest(p, 0.03)
                if hit[0] is not None and (p - hit[0]).dot(hit[1]) < 0 and hit[3] > 0.001:
                    depth = max(depth, hit[3]); n += 1
            if n:
                pairs.append((a, b, round(1000 * depth, 1), n))
    gaps = {}
    for a, o in objs.items():
        lo = boxes[a][0]
        bottom = [p for p in verts[a] if p.z < lo.z + 0.003]
        best = 1.0
        for p in bottom[:: max(1, len(bottom) // 40)]:
            for b, tb in trees.items():
                if b == a:
                    continue
                hit = tb.ray_cast(p + Vector((0, 0, 0.0005)), Vector((0, 0, -1)), 0.5)
                if hit[0] is not None:
                    best = min(best, hit[3] - 0.0005)
        gaps[a] = round(1000 * best, 1)
    return {"pairs": sorted(pairs, key=lambda r: -r[2]), "gaps_mm": gaps}


def build(ctx: C.Ctx) -> None:
    """Build the still life for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    scene = bpy.context.scene
    if ctx.P("view") == "standard":                               # for comparing with three.js (sRGB, no tone curve)
        scene.view_settings.view_transform = "Standard"; scene.view_settings.look = "None"
    if not ctx.P("denoise"):
        scene.cycles.use_denoising = False
    if ctx.P("engine") == "eevee":                               # Blender's rasteriser, same scene and colour pipeline
        scene.render.engine = next(e for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE") if e in {i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items})
        scene.eevee.taa_render_samples = 64
    C.hdri_world(ctx.asset("room", "env.hdr"), strength=1.0, rotation_deg=0)
    table, objs = load(ctx)
    tlo, thi = world_bbox(table)
    layout = ctx.P("layout")
    scale_bad = []
    place(objs, table, layout)
    for k, o in {"table": table, **objs}.items():
        lo, hi = world_bbox(o); m = max(hi - lo); a, b = SIZE_PRIOR[k]
        if not a <= m <= b:
            scale_bad.append((k, round(100 * m, 1)))
    info = {"layout": layout, "scale_violations": scale_bad}
    cache = os.path.join(ctx.project_dir, "out", "solved_layout.json")
    if layout == "solved" and ctx.P("reuse") and os.path.exists(cache):
        import json
        saved = json.load(open(cache))
        for k, m in saved["matrices"].items():
            objs[k].matrix_world = Matrix([m[i * 4:(i + 1) * 4] for i in range(4)])
        bpy.context.view_layer.update()
        info.update(saved["info"]); info["reused_layout"] = True
    elif layout == "solved":
        info["footprint_moves"] = separate_footprints(objs, tlo, thi)
        # fruit: placed one by one by a vertical sweep (first contact while descending, against the plate and the fruit
        # already placed), trying spots on a spiral around the intended one until the piece rests on the plate or on
        # fruit and inside the plate's rim; then everything settles once and is checked for pieces that moved away.
        plo, phi = world_bbox(objs["plate"]); pc = (plo + phi) / 2; prad = (phi.x - plo.x) / 2
        rounds, placed = [], []
        for k in FRUIT:                                          # rest pose: the orientation with the lowest centre
            o = objs[k]; lo, hi = world_bbox(o); c = (lo + hi) / 2; best = None
            for rot in (Matrix.Identity(4), Matrix.Rotation(math.pi / 2, 4, "X"), Matrix.Rotation(math.pi / 2, 4, "Y")):
                m = Matrix.Translation(c) @ rot @ Matrix.Translation(-c) @ o.matrix_world
                zs = [(m @ v.co).z for v in o.data.vertices]
                if best is None or max(zs) - min(zs) < best[0]:
                    best = (max(zs) - min(zs), m)
            o.matrix_world = best[1]; bpy.context.view_layer.update()
            if k not in ON_PLATE:
                sweep_drop(o, [table])
        for k in ON_PLATE:                                       # minimum potential energy among swept candidate spots
            o = objs[k]; home = o.matrix_world.copy(); best = None; tried = 0
            for r in (0.0, 0.015, 0.03, 0.045, 0.06):
                for j in range(1 if r == 0 else 8):
                    ang = 2 * math.pi * j / 8; tried += 1
                    o.matrix_world = Matrix.Translation(Vector((r * math.cos(ang), r * math.sin(ang), 0))) @ home
                    bpy.context.view_layer.update()
                    sweep_drop(o, [objs["plate"], *[objs[q] for q in placed]])
                    lo, hi = world_bbox(o); c = (lo + hi) / 2
                    if math.hypot(c.x - pc.x, c.y - pc.y) < prad - 0.01 and (best is None or c.z < best[0]):
                        best = (c.z, o.matrix_world.copy())
            if best:
                o.matrix_world = best[1]; bpy.context.view_layer.update()
            placed.append(k); rounds.append({"fruit": k, "candidates_tried": tried, "centre_above_table_mm": round(1000 * (best[0] - thi.z), 1) if best else None})
        for attempt in range(3):
            before = {k: objs[k].matrix_world.copy() for k in ON_PLATE}
            moved = settle(ctx, objs, table, int(ctx.P("settle_frames")), apply=True)
            off = [k for k in ON_PLATE if not on_plate(objs, k, pc, prad, thi.z)]
            rounds.append({"settle": attempt + 1, "max_move_mm": max(moved[k][0] for k in ON_PLATE), "off_plate": off})
            if not off:
                break
            for k in off:                                        # back to its sweep pose, nudged toward the plate centre, swept again
                o = objs[k]; o.matrix_world = before[k]; bpy.context.view_layer.update()
                lo, hi = world_bbox(o); c = (lo + hi) / 2
                o.matrix_world = Matrix.Translation(Vector(((pc.x - c.x) * 0.5, (pc.y - c.y) * 0.5, 0))) @ o.matrix_world
                bpy.context.view_layer.update()
                sweep_drop(o, [objs["plate"], *[objs[q] for q in ON_PLATE if q != k]])
        info["settle_rounds"] = rounds
        import json
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        json.dump({"matrices": {k: [x for row in o.matrix_world for x in row] for k, o in objs.items()},
                   "info": {k: info[k] for k in ("footprint_moves", "settle_rounds")}}, open(cache, "w"))
    info["probe_mm_deg"] = settle(ctx, objs, table, 90, apply=False)   # does the layout stay put under gravity?
    info.update(contact_report(objs, table))
    scene["c2v_still"] = {k: (str(v) if not isinstance(v, (int, float, str)) else v) for k, v in info.items()}
    globals()["_INFO"] = info
    look = Vector(((tlo.x + thi.x) / 2 + 0.02, (tlo.y + thi.y) / 2, thi.z + 0.08))
    if ctx.P("camera") == "hero":
        C.camera([(1, (0.55, -1.15, 1.22), look), (ctx.frames, (0.25, -1.22, 1.18), look)], lens=40, fstop=5.6)
    else:
        C.camera([(1, (0.55, -1.15, 1.22), look)], lens=40)
    floor = C.pbr_material("floor", color=(0.30, 0.25, 0.2), roughness=0.6)
    bpy.ops.mesh.primitive_plane_add(size=8); bpy.context.active_object.data.materials.append(floor)
    if ctx.P("export"):
        scene.frame_set(1)
        bpy.ops.export_scene.gltf(filepath=ctx.P("export"), export_format="GLB", export_cameras=True, export_lights=False, export_apply=True,
                                  export_yup=True)
    print("C2V still", {k: v for k, v in info.items() if k not in ("probe_mm_deg", "settle_mm_deg")})


def measure(ctx: C.Ctx) -> dict:
    """The layout report computed in build (contacts, gaps, physics probe, scale)."""
    info = globals().get("_INFO", {})
    pairs = info.get("pairs", [])
    gaps = info.get("gaps_mm", {})
    probe = info.get("probe_mm_deg", {})
    return {"layout": info.get("layout"), "scale_violations": info.get("scale_violations"),
            "penetrating_pairs_gt1mm": sum(1 for p in pairs if p[2] > 1), "max_penetration_mm": max([p[2] for p in pairs] or [0]),
            "worst_pairs": pairs[:5], "floating_or_embedded_gt3mm": sorted(k for k, g in gaps.items() if g > 3), "max_gap_mm": max(gaps.values() or [0]),
            "probe_max_move_mm": max([v[0] for v in probe.values()] or [0]), "probe_max_rot_deg": max([v[1] for v in probe.values()] or [0]),
            "probe_moved_gt5mm": sorted(k for k, v in probe.items() if v[0] > 5), "footprint_moves": info.get("footprint_moves"),
            "settle_rounds": info.get("settle_rounds")}
