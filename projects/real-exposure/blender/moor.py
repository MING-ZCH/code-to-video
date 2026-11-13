"""real-exposure / moor: a lone man in a dark coat, back to camera, in a misty field; utility poles fade into the fog.

Plate and light: Poly Haven misty_dawn (CC0). Fog: a 120 m homogeneous volume around the camera, so distance alone
fades the poles. The figure is simple geometry; in fog at 8 m only its silhouette reads. Edit parameters: fog density,
figure distance, pole count, HDRI rotation.
"""

from __future__ import annotations

import math

import bpy
import c2v_bpy as C

PARAMS = {"fog": 0.022, "figure_y": 9.0, "poles": 8, "hdri_rot": 205.0}


def build(ctx: C.Ctx) -> None:
    """Build the scene for ``ctx`` (see module docstring)."""
    C.setup_render(ctx, look="AgX - Base Contrast")
    bpy.context.scene.cycles.volume_step_rate = 4.0
    C.hdri_world(ctx.asset("fog", "env.hdr"), strength=1.0, rotation_deg=float(ctx.P("hdri_rot")))
    C.shadow_catcher(size=400)
    # fog volume around the camera
    bpy.ops.mesh.primitive_cube_add(size=240, location=(0, 60, 40))
    vol = bpy.context.active_object
    vm = bpy.data.materials.new("fog")
    vm.use_nodes = True
    nt = vm.node_tree
    nt.nodes.clear()
    sc = nt.nodes.new("ShaderNodeVolumePrincipled")
    sc.inputs["Density"].default_value = float(ctx.P("fog"))
    sc.inputs["Color"].default_value = (0.9, 0.9, 0.88, 1.0)
    nt.links.new(sc.outputs["Volume"], nt.nodes.new("ShaderNodeOutputMaterial").inputs["Volume"])
    vol.data.materials.append(vm)
    vol.visible_shadow = False
    # the man: long coat (cone frustum), shoulders, head, legs, all dark charcoal cloth
    cloth = C.pbr_material("coat", color=(0.035, 0.035, 0.04), roughness=0.9)
    y = float(ctx.P("figure_y"))
    parts = []
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.34, radius2=0.22, depth=1.05, location=(0, y, 0.92)); parts.append(bpy.context.active_object)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(0, y, 1.45)); parts.append(bpy.context.active_object)
    parts[-1].scale = (1.0, 0.6, 0.45)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.105, location=(0, y, 1.68)); parts.append(bpy.context.active_object)
    for dx in (-0.1, 0.1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=0.45, location=(dx, y, 0.22)); parts.append(bpy.context.active_object)
    for dx, rz in ((-0.3, 0.12), (0.3, -0.12)):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.72, location=(dx, y, 1.1), rotation=(0, rz, 0)); parts.append(bpy.context.active_object)
    for p in parts:
        p.data.materials.append(cloth)
        bpy.ops.object.select_all(action="DESELECT")
        p.select_set(True)
        bpy.context.view_layer.objects.active = p
        bpy.ops.object.shade_smooth()
    # utility poles receding to the right into the fog
    wood = C.pbr_material("pole", color=(0.08, 0.06, 0.045), roughness=0.85)
    for i in range(int(ctx.P("poles"))):
        px, py = 7.0 + i * 5.5, 14.0 + i * 26.0
        bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=10.0, location=(px, py, 5.0)); bpy.context.active_object.data.materials.append(wood)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(px, py, 9.2)); bar = bpy.context.active_object
        bar.scale = (2.2, 0.12, 0.12); bar.data.materials.append(wood)
    f = ctx.frames
    C.camera([(1, (0.0, 0.0, 1.45), (0.4, 30.0, 2.6)), (f, (0.0, 1.2, 1.45), (0.4, 30.0, 2.6))], lens=40)
