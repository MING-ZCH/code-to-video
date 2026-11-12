"""real-mobius: a Möbius strip floating in a void, an ant walking round and round it, sped up; fixed wide shot.

Geometry is the definition: x = (R + v cos(u/2)) cos u, y = (R + v cos(u/2)) sin u, z = v sin(u/2), u in [0, 2π),
v in [-w, w], with the seam at u = 2π joined to u = 0 with v reversed (one surface, one edge). The ant walks the centre
line v = 0 and stands on the surface normal; after one turn (Δu = 2π) the normal has flipped, so it is on the "other"
face of the same side, and only after Δu = 4π does it return to its start. Edit parameters: laps, strip colour, ant
speed profile.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import c2v_bpy as C

PARAMS = {"R": 1.0, "width": 0.42, "laps": 4.0, "strip": [0.9, 0.86, 0.8], "metal": 0.0, "ant_scale": 0.26}


def mobius_point(R: float, u: float, v: float) -> Vector:
    """Point of the Möbius strip at (u, v)."""
    return Vector(((R + v * math.cos(u / 2)) * math.cos(u), (R + v * math.cos(u / 2)) * math.sin(u), v * math.sin(u / 2)))


def mobius_frame(R: float, u: float) -> tuple[Vector, Vector, Vector]:
    """Centre-line point, unit tangent (increasing u) and unit surface normal at (u, 0); the normal flips after 2π."""
    e = 1e-4
    p = mobius_point(R, u, 0)
    tu = (mobius_point(R, u + e, 0) - mobius_point(R, u - e, 0)).normalized()
    tv = (mobius_point(R, u, e) - mobius_point(R, u, -e)).normalized()
    return p, tu, tu.cross(tv).normalized()


def strip_mesh(R: float, w: float, thick: float = 0.035, nu: int = 720, nv: int = 14) -> bpy.types.Object:
    """The strip as a closed solid. One sheet offset along the (flipping) normal over u in [0, 4π) covers both faces;
    walls join its v = +w edge at u to its v = -w edge at u + 2π, which is the same physical edge seen from the other face.
    No modifier has to cope with a non-orientable surface, so there is no seam."""
    bm = bmesh.new()
    rows = []
    for i in range(nu):
        u = 4 * math.pi * i / nu
        _, _, n = mobius_frame(R, u)
        rows.append([bm.verts.new(mobius_point(R, u, -w + 2 * w * j / (nv - 1)) + n * thick / 2) for j in range(nv)])
    half = nu // 2
    for i in range(nu):
        a, b = rows[i], rows[(i + 1) % nu]
        for j in range(nv - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
        c, d = rows[(i + half) % nu], rows[(i + 1 + half) % nu]
        bm.faces.new((a[-1], c[0], d[0], b[-1]))
    # UV = (u / 4π, v): the material draws a centre line and two edge lines that follow the half twist
    uv = bm.loops.layers.uv.new("UVMap")
    index = {v: (i, j) for i, row in enumerate(rows) for j, v in enumerate(row)}
    for face in bm.faces:
        ii = [index[l.vert][0] for l in face.loops]
        for l in face.loops:
            i, j = index[l.vert]
            if max(ii) - min(ii) > nu // 2 and i < nu // 2:
                i += nu                                         # the face that wraps from the last column to the first
            l[uv].uv = (i / nu, j / (nv - 1))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("mobius")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("mobius", mesh)
    bpy.context.collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def build_ant(scale: float) -> tuple[bpy.types.Object, list[tuple[bpy.types.Object, int, float]]]:
    """A glossy black ant (head, thorax, gaster, 6 legs, 2 antennae) parented to an empty; returns (root, legs)."""
    root = bpy.data.objects.new("ant", None)
    bpy.context.collection.objects.link(root)
    chitin = C.pbr_material("chitin", color=(0.03, 0.018, 0.012), roughness=0.22, coat=0.6)
    leg_mat = C.pbr_material("leg", color=(0.05, 0.03, 0.02), roughness=0.4)

    def part(op, loc, scl, mat, **kw):
        op(location=loc, **kw)
        o = bpy.context.active_object
        o.scale = scl
        o.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
        o.parent = root
        return o

    s = scale
    part(bpy.ops.mesh.primitive_uv_sphere_add, (0.55 * s, 0, 0.28 * s), (0.2 * s, 0.17 * s, 0.16 * s), chitin)        # head
    part(bpy.ops.mesh.primitive_uv_sphere_add, (0.15 * s, 0, 0.3 * s), (0.25 * s, 0.13 * s, 0.13 * s), chitin)        # thorax
    part(bpy.ops.mesh.primitive_uv_sphere_add, (-0.45 * s, 0, 0.32 * s), (0.36 * s, 0.25 * s, 0.24 * s), chitin)      # gaster
    legs = []
    for k, (lx, side) in enumerate(((0.3, 1), (0.15, 1), (0.0, 1), (0.3, -1), (0.15, -1), (0.0, -1))):
        o = part(bpy.ops.mesh.primitive_cylinder_add, (lx * s, side * 0.22 * s, 0.17 * s), (0.018 * s, 0.018 * s, 0.25 * s), leg_mat,
                 rotation=(side * math.radians(55), 0, 0))
        legs.append((o, side, (k % 2) * math.pi + (k // 3) * math.pi))  # tripod gait: alternate legs in phase
    for side in (1, -1):
        part(bpy.ops.mesh.primitive_cylinder_add, (0.8 * s, side * 0.1 * s, 0.45 * s), (0.012 * s, 0.012 * s, 0.22 * s), leg_mat,
             rotation=(0, math.radians(55), side * math.radians(25)))
    return root, legs


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Medium High Contrast")
    C.hdri_world(ctx.asset("studio", "env.hdr"), strength=0.8, rotation_deg=30, background=0.0)   # a void: the world lights, never shows
    R, w = float(ctx.P("R")), float(ctx.P("width"))
    strip = strip_mesh(R, w)
    mat = C.pbr_material("strip", color=tuple(ctx.P("strip")), metallic=float(ctx.P("metal")), roughness=0.3, coat=0.4)
    nt = mat.node_tree
    uvn = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uvn.outputs["UV"], sep.inputs["Vector"])
    # lines at v = 0.5 (centre, the ant's path) and near both edges: |v - c| < half width, as a 0/1 mask
    acc = None
    for c, hw in ((0.5, 0.012), (0.04, 0.012), (0.96, 0.012)):
        d = nt.nodes.new("ShaderNodeMath"); d.operation = "SUBTRACT"; d.inputs[1].default_value = c
        nt.links.new(sep.outputs["Y"], d.inputs[0])
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "ABSOLUTE"; nt.links.new(d.outputs[0], a.inputs[0])
        lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = hw
        nt.links.new(a.outputs[0], lt.inputs[0])
        if acc is None:
            acc = lt
        else:
            mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
            nt.links.new(acc.outputs[0], mx.inputs[0]); nt.links.new(lt.outputs[0], mx.inputs[1]); acc = mx
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*ctx.P("strip"), 1.0)
    mix.inputs[7].default_value = (0.75, 0.18, 0.08, 1.0)
    nt.links.new(acc.outputs[0], mix.inputs[0])
    nt.links.new(mix.outputs[2], nt.nodes["Principled BSDF"].inputs["Base Color"])
    strip.data.materials.append(mat)
    strip.rotation_euler = (math.radians(22), math.radians(-12), math.radians(35))
    ant, legs = build_ant(float(ctx.P("ant_scale")))
    lift = 0.0175 + 0.025 * float(ctx.P("ant_scale")) / 0.2
    laps, f = float(ctx.P("laps")), ctx.frames
    for frame in range(1, f + 1):
        k = (frame - 1) / max(1, f - 1)
        u = 2 * math.pi * laps * k
        p, t, n = mobius_frame(R, u)
        side = t.cross(n)
        basis = Matrix((t, side, n)).transposed()               # ant x = heading, z = surface normal
        world = strip.rotation_euler.to_matrix() @ basis
        ant.matrix_world = Matrix.Translation(strip.rotation_euler.to_matrix() @ (p + n * lift)) @ world.to_4x4()
        ant.keyframe_insert("location", frame=frame)
        ant.keyframe_insert("rotation_euler", frame=frame)
        stride = u * 9.0                                        # leg phase follows distance walked, so feet do not slide
        for leg, sd, ph in legs:
            leg.rotation_euler[1] = 0.45 * math.sin(stride + ph)
            leg.keyframe_insert("rotation_euler", frame=frame)
    C.area_light((-2.5, -3.0, 3.0), (0, 0, 0), power=500, size=3.0)
    C.area_light((3.0, 2.0, 1.5), (0, 0, 0), power=200, size=2.0, color=(0.8, 0.88, 1.0))
    C.camera([(1, (-1.2, -4.6, 2.4), (0.0, 0.0, -0.05))], lens=40)
