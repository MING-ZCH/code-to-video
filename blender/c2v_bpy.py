"""Helpers for Code-to-Video Blender scenes: path-traced layers that the p5 timeline composites as footage.

A project scene file (projects/<name>/blender/<scene>.py) defines ``build(ctx)``; ``ctx`` carries the params, the
project directory and the frame range. Everything here is deterministic: fixed Cycles seed, baked rigid-body caches,
no wall-clock input, so the same scene file and params give the same frames on the same machine.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

import bpy


@dataclass
class Ctx:
    """Build context handed to a scene's ``build``.

    Attributes:
        project_dir: Absolute path of projects/<name>.
        params: Edit parameters (scene defaults merged with --params overrides).
        fps: Frames per second of the layer.
        frames: Number of frames to simulate and render.
        width: Output width in pixels.
        height: Output height in pixels.
        samples: Cycles samples per pixel.
    """

    project_dir: str
    params: dict[str, Any] = field(default_factory=dict)
    fps: int = 24
    frames: int = 120
    width: int = 1920
    height: int = 1080
    samples: int = 64
    out: str = ""

    def cache(self, kind: str) -> str:
        """A per-layer cache directory (fluid bakes), next to the layer's frames."""
        path = os.path.join(self.out + "_cache", kind)
        os.makedirs(path, exist_ok=True)
        return path

    def asset(self, name: str, *parts: str) -> str:
        """Return the absolute path of a file inside projects/<name>/assets/<asset>/."""
        return os.path.join(self.project_dir, "assets", name, *parts)

    def P(self, key: str, default: Any = None) -> Any:
        """Read an edit parameter."""
        return self.params.get(key, default)


def reset_scene() -> bpy.types.Scene:
    """Empty the default scene and return it."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def setup_render(ctx: Ctx, motion_blur: bool = True, look: str = "AgX - Medium High Contrast") -> None:
    """Configure Cycles on the GPU with a fixed seed, denoising, filmic view transform and JPEG frame output."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for device_type in ("METAL", "OPTIX", "CUDA", "HIP"):
        try:
            prefs.compute_device_type = device_type
            prefs.get_devices()
            if any(d.type == device_type for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == device_type
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
    scene.cycles.samples = ctx.samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    scene.cycles.denoising_use_gpu = True
    scene.render.use_persistent_data = True          # keep BVH, textures and compiled kernels between frames
    scene.cycles.seed = 0
    scene.cycles.use_animated_seed = False
    scene.cycles.max_bounces = 8
    scene.render.resolution_x = ctx.width
    scene.render.resolution_y = ctx.height
    scene.render.resolution_percentage = 100
    scene.render.fps = ctx.fps
    scene.frame_start = 1
    scene.frame_end = ctx.frames
    scene.render.use_motion_blur = motion_blur
    scene.render.motion_blur_shutter = 0.5
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = look
    except TypeError:
        pass
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 95


def hdri_world(path: str, strength: float = 1.0, rotation_deg: float = 0.0, background: float | None = None) -> None:
    """Light the scene with an equirectangular HDRI; ``background`` scales how bright it appears to the camera."""
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value[2] = math.radians(rotation_deg)
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(path)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    if background is None:
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
        return
    # camera rays see a dimmer world than lighting rays
    cam_bg = nt.nodes.new("ShaderNodeBackground")
    cam_bg.inputs["Strength"].default_value = background
    nt.links.new(env.outputs["Color"], cam_bg.inputs["Color"])
    light_path = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(light_path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg.outputs["Background"], mix.inputs[1])
    nt.links.new(cam_bg.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])


MATERIAL_PRESETS: dict[str, dict[str, Any]] = {
    "gold": {"color": (1.0, 0.71, 0.29), "metallic": 1.0, "roughness": 0.22},
    "chrome": {"color": (0.95, 0.95, 0.96), "metallic": 1.0, "roughness": 0.06},
    "copper": {"color": (0.96, 0.58, 0.45), "metallic": 1.0, "roughness": 0.3},
    "glass": {"color": (0.97, 0.99, 1.0), "metallic": 0.0, "roughness": 0.0, "transmission": 1.0, "ior": 1.5},
    "rubber": {"color": (0.75, 0.08, 0.06), "metallic": 0.0, "roughness": 0.55, "coat": 0.3},
    "marble": {"color": (0.92, 0.91, 0.88), "metallic": 0.0, "roughness": 0.18, "subsurface": 0.2},
}


def pbr_material(name: str, preset: str | None = None, **kw: Any) -> bpy.types.Material:
    """Create a Principled BSDF material from a preset name and/or explicit values.

    Args:
        name: Material name.
        preset: A key of MATERIAL_PRESETS.
        **kw: color, metallic, roughness, transmission, ior, coat, subsurface overrides.

    Returns:
        The material.
    """
    v = {**MATERIAL_PRESETS.get(preset or "", {}), **kw}
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*v.get("color", (0.8, 0.8, 0.8)), 1.0)
    bsdf.inputs["Metallic"].default_value = v.get("metallic", 0.0)
    bsdf.inputs["Roughness"].default_value = v.get("roughness", 0.5)
    bsdf.inputs["Transmission Weight"].default_value = v.get("transmission", 0.0)
    bsdf.inputs["IOR"].default_value = v.get("ior", 1.45)
    bsdf.inputs["Coat Weight"].default_value = v.get("coat", 0.0)
    if v.get("subsurface"):
        bsdf.inputs["Subsurface Weight"].default_value = v["subsurface"]
    return mat


def texture_material(name: str, tex_dir: str, scale: float = 1.0, displacement: float = 0.0) -> bpy.types.Material:
    """Create a PBR material from a Poly Haven texture folder (Diffuse, Rough, nor_gl, optional Displacement)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(coord.outputs["UV"], mapping.inputs["Vector"])

    def image(file: str, color: bool) -> bpy.types.Node:
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(os.path.join(tex_dir, file))
        node.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
        nt.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    nt.links.new(image("Diffuse.jpg", True).outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(image("Rough.jpg", False).outputs["Color"], bsdf.inputs["Roughness"])
    normal_map = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(image("nor_gl.jpg", False).outputs["Color"], normal_map.inputs["Color"])
    nt.links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    if displacement > 0 and os.path.exists(os.path.join(tex_dir, "Displacement.jpg")):
        disp = nt.nodes.new("ShaderNodeDisplacement")
        disp.inputs["Scale"].default_value = displacement
        nt.links.new(image("Displacement.jpg", False).outputs["Color"], disp.inputs["Height"])
        nt.links.new(disp.outputs["Displacement"], nt.nodes["Material Output"].inputs["Displacement"])
    return mat


def ground(material: bpy.types.Material, size: float = 30.0, friction: float = 0.6, bounce: float = 0.2) -> bpy.types.Object:
    """A UV-mapped ground plane at z = 0 that is also a passive rigid body."""
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = "ground"
    obj.data.materials.append(material)
    rigid(obj, passive=True, friction=friction, bounce=bounce, shape="BOX")
    return obj


def text_mesh(body: str, font_path: str, size: float = 1.0, extrude: float = 0.1, bevel: float = 0.01, location: Sequence[float] = (0, 0, 0)) -> bpy.types.Object:
    """Extruded, bevelled text converted to a mesh, origin at its centre of mass."""
    curve = bpy.data.curves.new(type="FONT", name=f"txt_{body}")
    curve.body = body
    curve.font = bpy.data.fonts.load(font_path)
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    obj = bpy.data.objects.new(f"txt_{body}", curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.origin_set(type="ORIGIN_CENTER_OF_MASS", center="MEDIAN")
    obj.location = location
    obj.select_set(False)
    return obj


def rigid(obj: bpy.types.Object, passive: bool = False, mass: float = 1.0, friction: float = 0.5, bounce: float = 0.3,
          shape: str = "CONVEX_HULL", damping: tuple[float, float] = (0.04, 0.1)) -> None:
    """Add a rigid body to ``obj`` (creating the rigid-body world on first use)."""
    scene = bpy.context.scene
    if scene.rigidbody_world is None:
        bpy.ops.rigidbody.world_add()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.rigidbody.object_add(type="PASSIVE" if passive else "ACTIVE")
    obj.select_set(False)
    rb = obj.rigid_body
    rb.collision_shape = shape
    rb.mass = mass
    rb.friction = friction
    rb.restitution = bounce
    rb.linear_damping, rb.angular_damping = damping
    rb.collision_margin = 0.002


def release_at(obj: bpy.types.Object, frame: int) -> None:
    """Hold a rigid body where it is (kinematic) until ``frame``, then hand it to the simulation at rest."""
    rb = obj.rigid_body
    rb.kinematic = True
    rb.keyframe_insert("kinematic", frame=1)
    rb.keyframe_insert("kinematic", frame=max(1, frame - 1))
    rb.kinematic = False
    rb.keyframe_insert("kinematic", frame=frame)
    obj.keyframe_insert("location", frame=1)
    obj.keyframe_insert("rotation_euler", frame=1)


def physics_world(ctx: Ctx, gravity: float = 9.81, substeps: int = 20, iterations: int = 30) -> None:
    """Set gravity (m/s², downward) and solver accuracy, and cover the layer's frame range with the cache."""
    scene = bpy.context.scene
    if scene.rigidbody_world is None:
        bpy.ops.rigidbody.world_add()
    scene.use_gravity = True
    scene.gravity = (0.0, 0.0, -gravity)
    world = scene.rigidbody_world
    world.substeps_per_frame = substeps
    world.solver_iterations = iterations
    world.point_cache.frame_start = 1
    world.point_cache.frame_end = ctx.frames


def bake_physics() -> int:
    """Fill the rigid-body cache for the whole range before any frame renders.

    Renders then read stored transforms, so frame order, motion-blur sub-frames and preview subsets all see the same
    simulation. Bakes through the point cache when the operator runs headless, otherwise steps every frame in order
    (which fills the same cache). Returns the number of frames simulated.
    """
    scene = bpy.context.scene
    world = scene.rigidbody_world
    has_particles = any(m.type == "PARTICLE_SYSTEM" for o in scene.objects for m in o.modifiers)
    if world is None and not has_particles:
        return 0
    if world is None or has_particles:
        # particle caches (and the rigid-body cache with them) fill in order from the first frame
        for f in range(scene.frame_start, scene.frame_end + 1):
            scene.frame_set(f)
        return scene.frame_end - scene.frame_start + 1
    cache = world.point_cache
    try:
        with bpy.context.temp_override(scene=scene, point_cache=cache):
            bpy.ops.ptcache.free_bake()
            bpy.ops.ptcache.bake(bake=True)
    except RuntimeError:
        pass
    if not cache.is_baked:
        for f in range(cache.frame_start, cache.frame_end + 1):
            scene.frame_set(f)
    return cache.frame_end - cache.frame_start + 1


def camera(keys: Iterable[tuple[int, Sequence[float], Sequence[float]]], lens: float = 50.0, fstop: float | None = None,
           focus: bpy.types.Object | None = None, clip_end: float = 1000.0) -> bpy.types.Object:
    """A camera keyed at (frame, location, look-at target) triples, eased by Blender's default Bezier interpolation."""
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = lens
    cam_data.clip_end = clip_end                                 # Blender's default (100 m) hides distant sets
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    target = bpy.data.objects.new("cam_target", None)
    bpy.context.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    for frame, loc, look in keys:
        cam.location = loc
        cam.keyframe_insert("location", frame=frame)
        target.location = look
        target.keyframe_insert("location", frame=frame)
    if fstop:
        cam_data.dof.use_dof = True
        cam_data.dof.aperture_fstop = fstop
        cam_data.dof.focus_object = focus or target
    return cam


def area_light(location: Sequence[float], target: Sequence[float], power: float = 300.0, size: float = 2.0,
               color: Sequence[float] = (1.0, 0.95, 0.9)) -> bpy.types.Object:
    """A soft area light aimed at ``target``."""
    data = bpy.data.lights.new("area", type="AREA")
    data.energy = power
    data.size = size
    data.color = color
    obj = bpy.data.objects.new("area", data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    aim = bpy.data.objects.new("area_target", None)
    bpy.context.collection.objects.link(aim)
    aim.location = target
    c = obj.constraints.new("TRACK_TO")
    c.target = aim
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    return obj


def shadow_catcher(size: float = 60.0, friction: float = 0.7, bounce: float = 0.15) -> bpy.types.Object:
    """An invisible ground at z = 0 that only shows the shadows and light CG casts onto the HDRI's real ground."""
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = "shadow_catcher"
    obj.is_shadow_catcher = True
    rigid(obj, passive=True, friction=friction, bounce=bounce, shape="BOX")
    return obj


def explosion(ctx: Ctx, at: Sequence[float], frame: int, radius: float = 0.6, resolution: int = 128,
              domain_size: Sequence[float] = (9.0, 9.0, 7.0), fuel: float = 2.0, temperature: float = 2.5,
              burst: float = 6.0, emit_frames: int = 6, smoke_color: Sequence[float] = (0.06, 0.055, 0.05),
              fire: float = 6.0, noise: int = 1) -> bpy.types.Object:
    """A Mantaflow fire-and-smoke explosion: a sphere that emits fuel outward for ``emit_frames`` from ``frame``.

    Returns the domain object (its volume material reads density and flame from the bake).
    """
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=radius, location=at)
    flow = bpy.context.active_object
    flow.name = "blast_flow"
    flow_mod = flow.modifiers.new("Fluid", "FLUID")
    flow_mod.fluid_type = "FLOW"
    bpy.ops.mesh.primitive_cube_add(size=2, location=(at[0], at[1], domain_size[2] / 2))
    domain = bpy.context.active_object
    domain.name = "blast_domain"
    domain.scale = (domain_size[0] / 2, domain_size[1] / 2, domain_size[2] / 2)
    dom_mod = domain.modifiers.new("Fluid", "FLUID")
    dom_mod.fluid_type = "DOMAIN"
    dom = dom_mod.domain_settings
    dom.domain_type = "GAS"
    dom.resolution_max = resolution
    dom.cache_type = "ALL"
    dom.cache_directory = ctx.cache("fluid")
    dom.cache_frame_start = 1
    dom.cache_frame_end = ctx.frames
    dom.vorticity = 0.4
    dom.alpha = 0.4
    dom.beta = 2.2
    dom.burning_rate = 0.55
    dom.flame_smoke = 1.6
    dom.flame_vorticity = 0.9
    dom.use_noise = noise > 1
    dom.noise_scale = max(2, noise)
    dom.noise_strength = 1.2
    dom.use_dissolve_smoke = True
    dom.dissolve_speed = int(ctx.frames * 1.5)
    fs = flow_mod.flow_settings
    fs.flow_type = "BOTH"
    fs.flow_behavior = "INFLOW"
    fs.flow_source = "MESH"
    fs.use_initial_velocity = True
    fs.smoke_color = smoke_color
    keys = [(1, 0.0, 0.0, 0.0), (frame - 1, 0.0, 0.0, 0.0), (frame, fuel, temperature, burst),
            (frame + emit_frames, fuel * 0.6, temperature, burst * 0.4), (frame + emit_frames + 1, 0.0, 0.0, 0.0)]
    for f, fu, temp, vel in keys:
        fs.fuel_amount, fs.density, fs.temperature, fs.velocity_normal = fu, fu * 0.8, temp, vel
        for prop in ("fuel_amount", "density", "temperature", "velocity_normal"):
            fs.keyframe_insert(prop, frame=f)
    flow.hide_render = True
    domain.data.materials.append(_smoke_material(smoke_color, fire))
    return domain


def _smoke_material(smoke_color: Sequence[float], fire: float) -> bpy.types.Material:
    """Volume shader for a Mantaflow gas domain: smoke from the density grid, flame light from the flame grid."""
    mat = bpy.data.materials.new("blast_volume")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*smoke_color, 1.0)
    vol.inputs["Density"].default_value = 5.0
    vol.inputs["Anisotropy"].default_value = 0.3
    flame = nt.nodes.new("ShaderNodeAttribute")
    flame.attribute_name = "flame"
    # flame colour is blackbody radiation: the reaction maps to 900–2200 K, so hot cores read yellow-orange and cooling
    # edges deep red, as real combustion does
    kelvin = nt.nodes.new("ShaderNodeMapRange")
    kelvin.inputs["To Min"].default_value = 900.0
    kelvin.inputs["To Max"].default_value = 2200.0
    blackbody = nt.nodes.new("ShaderNodeBlackbody")
    # brightness grows with flame squared, so the core burns and the edges fall off into smoke
    square = nt.nodes.new("ShaderNodeMath")
    square.operation = "POWER"
    square.inputs[1].default_value = 2.0
    strength = nt.nodes.new("ShaderNodeMath")
    strength.operation = "MULTIPLY"
    strength.inputs[1].default_value = fire
    nt.links.new(flame.outputs["Fac"], kelvin.inputs["Value"])
    nt.links.new(kelvin.outputs["Result"], blackbody.inputs["Temperature"])
    nt.links.new(flame.outputs["Fac"], square.inputs[0])
    nt.links.new(square.outputs["Value"], strength.inputs[0])
    nt.links.new(blackbody.outputs["Color"], vol.inputs["Emission Color"])
    nt.links.new(strength.outputs["Value"], vol.inputs["Emission Strength"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return mat


def sparks(at: Sequence[float], frame: int, count: int = 600, speed: float = 11.0, spread: float = 6.0,
           life: int = 40, size: float = 0.012, glow: float = 40.0, seed: int = 0) -> bpy.types.Object:
    """Burning embers thrown out at ``frame``: a particle burst of tiny emissive spheres falling under gravity.

    With Cycles motion blur each ember renders as a streak along its ballistic path.
    """
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.3, location=at)
    emitter = bpy.context.active_object
    emitter.name = "sparks_emitter"
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size, location=(0, 0, -50))
    ember = bpy.context.active_object
    ember.name = "ember"
    mat = bpy.data.materials.new("ember")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    emit = nt.nodes.new("ShaderNodeEmission")
    bb = nt.nodes.new("ShaderNodeBlackbody")
    bb.inputs["Temperature"].default_value = 1800.0
    emit.inputs["Strength"].default_value = glow
    nt.links.new(bb.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], nt.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
    ember.data.materials.append(mat)
    mod = emitter.modifiers.new("sparks", "PARTICLE_SYSTEM")
    ps = mod.particle_system
    ps.seed = seed
    st = ps.settings
    st.count = count
    st.frame_start = frame
    st.frame_end = frame + 2
    st.lifetime = life
    st.lifetime_random = 0.5
    st.emit_from = "FACE"
    st.normal_factor = speed
    st.factor_random = spread
    st.object_align_factor = (0.0, 0.0, speed * 0.5)
    st.render_type = "OBJECT"
    st.instance_object = ember
    st.particle_size = 1.0
    st.size_random = 0.6
    st.use_rotations = False
    st.effector_weights.gravity = 1.0
    st.drag_factor = 0.15
    emitter.show_instancer_for_render = False
    return emitter


def bake_fluid(domain: bpy.types.Object) -> None:
    """Bake a Mantaflow domain (all data at once) before rendering."""
    with bpy.context.temp_override(object=domain, active_object=domain, selected_objects=[domain]):
        bpy.ops.fluid.free_all()
        bpy.ops.fluid.bake_all()


def debris(ctx: Ctx, count: int, center: Sequence[float], spread: float, material: bpy.types.Material,
           size: tuple[float, float] = (0.05, 0.16), seed: int = 0) -> list[bpy.types.Object]:
    """Irregular rock chunks resting on the ground around ``center``, as active rigid bodies."""
    out = []
    for i in range(count):
        h = lambda k: hash01(i * 13.7 + k + seed * 101.3)
        r = size[0] + (size[1] - size[0]) * h(1) ** 2
        ang, dist = h(2) * math.tau, spread * math.sqrt(h(3))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0, radius=r, location=(center[0] + math.cos(ang) * dist, center[1] + math.sin(ang) * dist, r * 0.6))
        obj = bpy.context.active_object
        obj.name = f"chunk_{i:03d}"
        for j, v in enumerate(obj.data.vertices):         # an angular, flattened rock rather than a ball
            v.co *= 0.5 + 0.9 * hash01(i * 31.1 + j * 2.7 + seed)
        obj.scale = (1.0 + 0.6 * h(7), 0.7 + 0.5 * h(8), 0.45 + 0.35 * h(9))
        obj.rotation_euler = (h(4) * 0.6, h(5) * 0.6, h(6) * 6.28)
        obj.data.materials.append(material)
        rigid(obj, mass=1.5, friction=0.8, bounce=0.2, shape="CONVEX_HULL", damping=(0.08, 0.2))
        out.append(obj)
    return out


def radial_push(at: Sequence[float], frame: int, strength: float, reach: float = 4.0, frames: int = 1) -> bpy.types.Object:
    """A radial force field that fires for ``frames`` frames at ``frame`` (an explosion's push on rigid bodies)."""
    bpy.ops.object.effector_add(type="FORCE", location=at)
    obj = bpy.context.active_object
    obj.name = "blast_push"
    fld = obj.field
    fld.use_max_distance = True
    fld.distance_max = reach
    fld.falloff_power = 1.0
    for f, s in ((1, 0.0), (frame - 1, 0.0), (frame, strength), (frame + frames - 1, strength), (frame + frames, 0.0)):
        fld.strength = s
        fld.keyframe_insert("strength", frame=f)
    return obj


def import_gltf(path: str, scale: float = 1.0, location: Sequence[float] = (0, 0, 0), rotation_z_deg: float = 0.0
                ) -> tuple[bpy.types.Object | None, list[bpy.types.Object]]:
    """Import a glTF/GLB character or prop; return (armature or None, meshes).

    The importer's bone-shape helper mesh (an unmaterialled "Icosphere") is hidden from render, and the root is moved,
    rotated and scaled as one piece.
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == "MESH" and o.name.startswith("Icosphere") and not o.data.materials:
            o.hide_render = True
            o.hide_viewport = True
    roots = [o for o in new if o.parent is None]
    for r in roots:
        r.scale = tuple(s * scale for s in r.scale)
        r.location = location
        r.rotation_euler[2] += math.radians(rotation_z_deg)
    armature = next((o for o in new if o.type == "ARMATURE"), None)
    meshes = [o for o in new if o.type == "MESH" and not o.hide_render]
    return armature, meshes


def nla_sequence(armature: bpy.types.Object, clips: Sequence[tuple[str, int, float, float]], blend: int = 6) -> None:
    """Play actions one after another on ``armature`` through NLA strips, cross-blended by ``blend`` frames.

    Args:
        armature: The armature object.
        clips: (action name, scene start frame, action first frame, action last frame) in order.
        blend: Frames of blend-in for every strip after the first.
    """
    ad = armature.animation_data or armature.animation_data_create()
    ad.action = None
    for i, (name, start, a0, a1) in enumerate(clips):
        track = ad.nla_tracks.new()
        track.name = f"c2v_{i}_{name}"
        strip = track.strips.new(name, int(start), bpy.data.actions[name])
        strip.action_frame_start, strip.action_frame_end = a0, a1
        strip.frame_end = start + (a1 - a0)
        strip.extrapolation = "HOLD_FORWARD" if i == len(clips) - 1 else "NOTHING"
        if i:
            strip.blend_in = blend
        strip.blend_type = "REPLACE"


def restyle_materials(objects: Iterable[bpy.types.Object], rules: dict[str, dict[str, Any]]) -> None:
    """Edit Principled BSDF inputs of imported materials by material name (e.g. a toy's paint and metal)."""
    seen = set()
    for o in objects:
        for mat in o.data.materials:
            if mat is None or mat.name in seen or mat.name not in rules or not mat.use_nodes:
                continue
            seen.add(mat.name)
            bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bsdf is None:
                continue
            for key, value in rules[mat.name].items():
                if key == "Base Color" and len(value) == 3:
                    value = (*value, 1.0)
                for link in list(bsdf.inputs[key].links):
                    mat.node_tree.links.remove(link)
                bsdf.inputs[key].default_value = value


def hash01(i: float) -> float:
    """Deterministic pseudo-random value in [0, 1) (the same hash as engine/core.js)."""
    x = math.sin(i * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def fix_biped_tails(rig: bpy.types.Object) -> None:
    """Point 3ds Max Biped arm and finger bones at the next joint and zero the pose.

    FBX import guesses Biped bone tails off the limb, so IK (which ends at a bone's tail) misses the real wrist by
    centimetres. Upper arm → elbow, forearm → wrist, finger → next knuckle; rest-pose edits leave the skinned mesh in
    place. The FBX take's pose values are cleared too.
    """
    rig.animation_data_clear()
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = rig.data.edit_bones
    for s in ("L", "R"):
        eb[f"Bip01 {s} UpperArm"].tail = eb[f"Bip01 {s} Forearm"].head
        eb[f"Bip01 {s} Forearm"].tail = eb[f"Bip01 {s} Hand"].head
        for k in range(5):
            a, b, c = (eb[f"Bip01 {s} Finger{k}{x}"] for x in ("", "1", "2"))
            a.tail = b.head
            b.tail = c.head
            c.tail = c.head + (c.head - b.head) * 0.8
    bpy.ops.object.mode_set(mode="OBJECT")
