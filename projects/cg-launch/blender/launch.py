"""cg-launch: an SLS night launch built in code, with NASA's own 3D model of the rocket.

Rocket: NASA 3D Resources "Space Launch System (SLS)" (printable STL), scaled to its real 98 m and coloured by part
(core stage foam orange, white boosters, upper stage and Orion, dark engine bells). Pad: a procedural mobile launcher
(deck + lattice tower + umbilical arms) on concrete, xenon floodlights, Poly Haven rogland_clear_night sky. Exhaust: a
Mantaflow gas simulation emitted from the engines and moving with the rocket, plus a flickering light at the nozzles.
Motion: core-stage engines light at `rs25_frame`, liftoff at `liftoff_frame`, then z = a t² / 2 with a = (T/W - 1) g.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Vector

import c2v_bpy as C

PARAMS = {"rs25_frame": 14, "liftoff_frame": 62, "thrust_to_weight": 1.5, "seed": 0}
H_REAL = 98.0      # SLS Block 1 height (m)
DECK = 8.0         # mobile launcher deck height (m)


def rocket(ctx: C.Ctx) -> tuple[bpy.types.Object, list[Vector]]:
    """Import, scale and colour the NASA SLS model; return (root empty, nozzle exit points in rocket space)."""
    stl = ctx.asset("sls", "Space Launch System (SLS).stl")
    bpy.ops.wm.stl_import(filepath=stl, forward_axis="NEGATIVE_Z", up_axis="Y")
    body = bpy.context.active_object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)   # the importer rotates the object, not the mesh
    s = H_REAL / body.dimensions.z
    body.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    zmin = min((body.matrix_world @ v.co).z for v in body.data.vertices)
    body.location = (0.0, 0.0, body.location.z - zmin)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.separate(type="LOOSE"); bpy.ops.object.mode_set(mode="OBJECT")
    parts = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name.startswith("Space Launch")]
    core = max(parts, key=lambda o: o.dimensions.z)
    foam = C.pbr_material("foam", color=(0.62, 0.26, 0.07), roughness=0.85)
    white = C.pbr_material("white", color=(0.82, 0.82, 0.8), roughness=0.45)
    metal = C.pbr_material("bell", color=(0.18, 0.17, 0.16), metallic=0.9, roughness=0.35)
    grey = C.pbr_material("grey", color=(0.45, 0.45, 0.47), metallic=0.6, roughness=0.45)
    # the core part carries stage, adapter, ICPS and Orion: foam below 61 % of its height, white above
    core_mat = foam.copy(); core_mat.name = "core"
    nt = core_mat.node_tree
    gen = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(gen.outputs["Generated"], sep.inputs["Vector"])
    step = nt.nodes.new("ShaderNodeMath"); step.operation = "GREATER_THAN"; step.inputs[1].default_value = 0.61
    nt.links.new(sep.outputs["Z"], step.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.62, 0.26, 0.07, 1); mix.inputs[7].default_value = (0.82, 0.82, 0.8, 1)
    nt.links.new(step.outputs[0], mix.inputs[0]); nt.links.new(mix.outputs[2], nt.nodes["Principled BSDF"].inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeMapRange"); rough.inputs["To Min"].default_value = 0.85; rough.inputs["To Max"].default_value = 0.45
    nt.links.new(step.outputs[0], rough.inputs["Value"]); nt.links.new(rough.outputs["Result"], nt.nodes["Principled BSDF"].inputs["Roughness"])
    root = bpy.data.objects.new("rocket", None); bpy.context.collection.objects.link(root)
    nozzles = []
    for o in parts:
        o.data.materials.clear()
        h, zc = o.dimensions.z, sum((o.matrix_world @ v.co).z for v in o.data.vertices) / len(o.data.vertices)
        if o is core:
            o.data.materials.append(core_mat)
        elif h > 40:
            o.data.materials.append(white)                       # solid rocket boosters
        elif max((o.matrix_world @ v.co).z for v in o.data.vertices) < 10.0:
            o.data.materials.append(metal)                       # engine bells and booster nozzles
            lo = min((o.matrix_world @ v.co).z for v in o.data.vertices)
            c = sum((o.matrix_world @ v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
            nozzles.append(Vector((c.x, c.y, lo)))
        else:
            o.data.materials.append(grey)
        for p in o.data.polygons:
            p.use_smooth = True
        o.parent = root
    root.location.z = DECK
    return root, nozzles


def launcher(ctx: C.Ctx) -> None:
    """Mobile launcher: a deck with an exhaust hole, a square lattice tower beside the rocket, three umbilical arms."""
    steel = C.pbr_material("steel", color=(0.22, 0.22, 0.23), metallic=0.7, roughness=0.5)
    beams = []

    def beam(a: Vector, b: Vector, t: float = 0.7) -> None:
        d = b - a
        bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2)
        o = bpy.context.active_object
        o.scale = (t, t, d.length)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
        beams.append(o)

    for x0, y0, sx, sy in ((-26, -22, 52, 13), (-26, 9, 52, 13), (-26, -9, 14, 18), (12, -9, 14, 18)):   # deck around a 24×18 hole
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x0 + sx / 2, y0 + sy / 2, DECK / 2)); o = bpy.context.active_object
        o.scale = (sx, sy, DECK); beams.append(o)
    tx, ty, side, top, bay = 22.0, 10.0, 12.0, 118.0, 6.0
    corners = [Vector((tx + dx, ty + dy, DECK)) for dx in (0, side) for dy in (0, side)]
    for c in corners:
        beam(c, c + Vector((0, 0, top)), 1.0)
    order = [corners[0], corners[1], corners[3], corners[2]]
    for k in range(int(top / bay)):
        z0, z1 = k * bay, (k + 1) * bay
        for a, b in zip(order, order[1:] + order[:1]):
            beam(a + Vector((0, 0, z1)), b + Vector((0, 0, z1)), 0.5)
            beam(a + Vector((0, 0, z0)), b + Vector((0, 0, z1)), 0.35)
    for zf in (0.45, 0.62, 0.8):                                  # umbilical arms reaching to the rocket
        z = DECK + top * zf
        beam(Vector((tx, ty + side / 2, z)), Vector((4.5, 2.0, z)), 1.4)
    for o in beams:
        o.data.materials.append(steel)
    bpy.ops.object.select_all(action="DESELECT")
    for o in beams:
        o.select_set(True)
    bpy.context.view_layer.objects.active = beams[0]
    bpy.ops.object.join()


def _volume_material(name, color, density, emission, kelvin, noise_scale, contrast, frame0, ctx, falloff="sphere", seed=0):
    """Volume shader: density = noise(object coords, W = time) through a ramp, times a radial or axial falloff."""
    mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1.0); vol.inputs["Anisotropy"].default_value = 0.4
    tc = nt.nodes.new("ShaderNodeTexCoord")
    # normalised coordinates: Generated (0..1 over the object's box) re-centred to -1..1, so falloffs ignore object size
    cen = nt.nodes.new("ShaderNodeVectorMath"); cen.operation = "MULTIPLY_ADD"
    cen.inputs[1].default_value = (2.0, 2.0, 2.0); cen.inputs[2].default_value = (-1.0, -1.0, -1.0)
    nt.links.new(tc.outputs["Generated"], cen.inputs[0])
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = noise_scale; noise.inputs["Detail"].default_value = 9.0; noise.inputs["Roughness"].default_value = 0.62
    nt.links.new(cen.outputs["Vector"], noise.inputs["Vector"])
    for f in range(1, ctx.frames + 1, 6):                      # evolution: W follows time
        noise.inputs["W"].default_value = seed * 7.3 + 0.35 * max(0, f - frame0) / ctx.fps
        noise.inputs["W"].keyframe_insert("default_value", frame=f)
    ramp = nt.nodes.new("ShaderNodeMapRange"); ramp.inputs["From Min"].default_value, ramp.inputs["From Max"].default_value = contrast
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    length = nt.nodes.new("ShaderNodeVectorMath"); length.operation = "LENGTH"
    if falloff == "axial":
        sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(cen.outputs["Vector"], sep.inputs["Vector"])
        comb = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(sep.outputs["X"], comb.inputs["X"]); nt.links.new(sep.outputs["Y"], comb.inputs["Y"])
        nt.links.new(comb.outputs["Vector"], length.inputs[0])
    else:
        nt.links.new(cen.outputs["Vector"], length.inputs[0])
    fall = nt.nodes.new("ShaderNodeMapRange"); fall.inputs["From Min"].default_value = 1.0; fall.inputs["From Max"].default_value = 0.35
    nt.links.new(length.outputs["Value"], fall.inputs["Value"])
    if falloff == "axial":                                      # radial core × fade away from the nozzle (local +z = exit)
        d0 = nt.nodes.new("ShaderNodeMath"); d0.operation = "MULTIPLY"; nt.links.new(ramp.outputs["Result"], d0.inputs[0]); nt.links.new(fall.outputs["Result"], d0.inputs[1])
        zf = nt.nodes.new("ShaderNodeMapRange"); zf.inputs["From Min"].default_value = -1.0; zf.inputs["From Max"].default_value = 1.0
        zf.inputs["To Min"].default_value = 0.0; zf.inputs["To Max"].default_value = 1.0
        nt.links.new(sep.outputs["Z"], zf.inputs["Value"])
        zp = nt.nodes.new("ShaderNodeMath"); zp.operation = "POWER"; zp.inputs[1].default_value = 2.2; nt.links.new(zf.outputs["Result"], zp.inputs[0])
        dens = nt.nodes.new("ShaderNodeMath"); dens.operation = "MULTIPLY"; nt.links.new(d0.outputs[0], dens.inputs[0]); nt.links.new(zp.outputs[0], dens.inputs[1])
    else:                                                       # the edge follows a noise isosurface: billows, not a blob
        rad = nt.nodes.new("ShaderNodeMath"); rad.operation = "MULTIPLY_ADD"; rad.inputs[1].default_value = -0.75; rad.inputs[2].default_value = 0.55
        nt.links.new(length.outputs["Value"], rad.inputs[0])
        add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"; nt.links.new(noise.outputs["Fac"], add.inputs[0]); nt.links.new(rad.outputs[0], add.inputs[1])
        dens = nt.nodes.new("ShaderNodeMapRange"); dens.inputs["From Min"].default_value = 0.5; dens.inputs["From Max"].default_value = 0.62
        nt.links.new(add.outputs[0], dens.inputs["Value"])
    dmul = nt.nodes.new("ShaderNodeMath"); dmul.operation = "MULTIPLY"; dmul.inputs[1].default_value = density
    nt.links.new(dens.outputs[0], dmul.inputs[0]); nt.links.new(dmul.outputs[0], vol.inputs["Density"])
    if emission > 0:
        bb = nt.nodes.new("ShaderNodeBlackbody"); bb.inputs["Temperature"].default_value = kelvin
        nt.links.new(bb.outputs["Color"], vol.inputs["Emission Color"])
        emul = nt.nodes.new("ShaderNodeMath"); emul.operation = "MULTIPLY"; emul.inputs[1].default_value = emission
        nt.links.new(dens.outputs[0], emul.inputs[0]); nt.links.new(emul.outputs[0], vol.inputs["Emission Strength"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return mat


def exhaust_core(name, at, radius, length, start, ctx):
    """A glowing exhaust cone hanging from a nozzle; it lights at `start` (scale 0 before)."""
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=radius * 2.4, radius2=radius, depth=length, location=(at.x, at.y, at.z - length / 2))
    o = bpy.context.active_object; o.name = name
    o.data.materials.append(_volume_material(name, (1.0, 0.8, 0.6), 0.5, 22.0, 2300.0, 3.0, (0.2, 0.75), start, ctx, falloff="axial"))
    for f, sc in ((1, 0.2), (start - 1, 0.2), (start + 3, 1.0)):
        o.scale = (sc, sc, sc); o.keyframe_insert("scale", frame=f)
    _hide_until(o, start)
    return o


def steam_cloud(name, c0, c1, r1, start, ctx, seed=0):
    """A billowing steam / smoke cloud growing from the trench (c0, small) to c1 with radius r1 over ~5 s."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=c0)
    o = bpy.context.active_object; o.name = name
    o.data.materials.append(_volume_material(name, (0.72, 0.7, 0.68), 0.09, 0.0, 0.0, 3.6, (0.46, 0.64), start, ctx, seed=seed))
    for f in range(1, ctx.frames + 1, 4):
        k = 0.0 if f < start else 1 - math.exp(-(f - start) / ctx.fps / 1.6)
        o.location = c0.lerp(c1, k); r = max(0.5, r1 * k)
        o.scale = (r, r * 0.95, r * 0.7)
        o.keyframe_insert("location", frame=f); o.keyframe_insert("scale", frame=f)
    _hide_until(o, start)
    return o


def _hide_until(o, start):
    """Hidden from render before `start` (a zero-size volume would break Cycles' volume grid)."""
    for f, hide in ((1, True), (start - 1, True), (start, False)):
        o.hide_render = hide; o.keyframe_insert("hide_render", frame=max(1, f))


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Base Contrast")
    sc = bpy.context.scene
    sc.cycles.volume_step_rate = 3.0
    sc.cycles.volume_bounces = 1
    C.hdri_world(ctx.asset("night", "env.hdr"), strength=0.6, rotation_deg=120, background=0.0)   # lit by the sky, sees black
    gnd = C.ground(C.texture_material("concrete", ctx.asset("concrete"), scale=60.0), size=1500)
    root, nozzles = rocket(ctx)
    launcher(ctx)
    for x, y in ((-160, -140), (150, -170), (-120, 170), (200, 120)):   # xenon floodlights on the rocket
        d = bpy.data.lights.new("flood", "SPOT"); d.energy = 2.5e5; d.spot_size = math.radians(14); d.color = (0.92, 0.95, 1.0); d.shadow_soft_size = 2.0
        o = bpy.data.objects.new("flood", d); bpy.context.collection.objects.link(o); o.location = (x, y, 6)
        aim = bpy.data.objects.new("flood_aim", None); bpy.context.collection.objects.link(aim); aim.location = (0, 0, 55)
        cns = o.constraints.new("TRACK_TO"); cns.target = aim; cns.track_axis = "TRACK_NEGATIVE_Z"; cns.up_axis = "UP_Y"
    f0, f1, g = int(ctx.P("rs25_frame")), int(ctx.P("liftoff_frame")), 9.81
    a = (float(ctx.P("thrust_to_weight")) - 1.0) * g
    for f in range(1, ctx.frames + 1):                           # ascent, closed form
        t = max(0.0, (f - f1) / ctx.fps)
        root.location.z = DECK + 0.5 * a * t * t
        root.keyframe_insert("location", frame=f)
    # exhaust: procedural volumes (no fluid solver). A glowing core per nozzle (blackbody colour) and steam clouds that
    # billow out of the flame trench on both sides, density from animated 4D noise.
    exits = [Vector((6.3 * sgn, 0.0, 0.5)) for sgn in (1, -1)] + [Vector((dx, dy, 0.3)) for dx in (-2.0, 2.0) for dy in (-2.0, 2.0)]
    for i, e in enumerate(exits):
        booster = abs(e.x) > 4
        core = exhaust_core(f"core_{i}", e, 2.2 if booster else 1.2, 55.0 if booster else 28.0, f1 if booster else f0, ctx)
        core.parent = root                                       # placed in rocket-local coordinates (identity inverse)
    for k, (cx, cy, r1, delay) in enumerate(((-38, 6, 34, 0), (40, -4, 36, 4), (-70, -14, 30, 14), (74, 12, 30, 18), (-22, -30, 24, 26), (26, 28, 24, 30), (0, 0, 20, 2))):
        steam_cloud(f"steam_{k}", Vector((cx * 0.25, cy * 0.25, 6.0)), Vector((cx, cy, 14.0 + r1 * 0.35)), r1, f0 + 6 + delay, ctx, seed=k)
    # nozzle light: a warm, flickering source under the rocket, so the plume lights the pad, tower and steam
    L = bpy.data.lights.new("exhaust", "POINT"); L.shadow_soft_size = 6.0; L.color = (1.0, 0.62, 0.3)
    lo = bpy.data.objects.new("exhaust", L); bpy.context.collection.objects.link(lo); lo.parent = root; lo.location = (0, 0, -6)
    for f in range(1, ctx.frames + 1):
        on = 0.0 if f < f0 else (0.35 if f < f1 else 1.0)
        L.energy = on * 6e7 * (0.85 + 0.3 * C.hash01(f * 1.7))
        L.keyframe_insert("energy", frame=f)
    cam_track = []
    for f in (1, f1, ctx.frames):
        t = max(0.0, (f - f1) / ctx.fps)
        cam_track.append((f, (-760.0, -900.0, 14.0), (4.0, 0.0, 42.0 + 0.5 * a * t * t)))
    C.camera(cam_track, lens=160, clip_end=5000.0)
