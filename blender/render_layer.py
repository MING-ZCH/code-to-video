"""Render a Code-to-Video Blender scene to a JPEG frame sequence.

Run by ``c2v blender`` as:
    blender -b --factory-startup --python blender/render_layer.py -- --scene <file.py> --out <dir> --project <dir>
        [--params '{"k": v}'] [--frames 120] [--fps 24] [--width 1920] [--height 1080] [--samples 64] [--only 1,60,120]

The scene file defines ``PARAMS`` (defaults) and ``build(ctx)``. Frames are written as <out>/f00001.jpg ... and a
meta.json with the layer's size, fps, frame count and timing.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402

import c2v_bpy  # noqa: E402


def parse_args() -> argparse.Namespace:
    """Parse the arguments after Blender's ``--`` separator."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--project", required=True)
    ap.add_argument("--params", default="{}")
    ap.add_argument("--frames", type=int, default=120)
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--only", default="", help="comma-separated frame numbers to render (preview)")
    return ap.parse_args(argv)


def main() -> None:
    """Build the scene, bake physics, render the requested frames and write meta.json."""
    a = parse_args()
    spec = importlib.util.spec_from_file_location("c2v_scene", a.scene)
    scene_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scene_mod)
    params = {**getattr(scene_mod, "PARAMS", {}), **json.loads(a.params)}
    ctx = c2v_bpy.Ctx(project_dir=os.path.abspath(a.project), params=params, fps=a.fps, frames=a.frames,
                      width=a.width, height=a.height, samples=a.samples, out=os.path.abspath(a.out))
    c2v_bpy.reset_scene()
    t0 = time.time()
    scene_mod.build(ctx)
    simulated = c2v_bpy.bake_physics()
    # optional: the scene measures its own simulation (impact times, final poses) for the composite to sync sound to
    measured = scene_mod.measure(ctx) if hasattr(scene_mod, "measure") else None
    t_build = time.time() - t0
    print(f"C2V build+bake {t_build:.1f} s ({simulated} frames simulated, baked={bool(bpy.context.scene.rigidbody_world and bpy.context.scene.rigidbody_world.point_cache.is_baked)})", flush=True)
    os.makedirs(a.out, exist_ok=True)
    scene = bpy.context.scene
    frames = [int(f) for f in a.only.split(",") if f] or list(range(1, a.frames + 1))
    t1 = time.time()
    for f in frames:
        tf = time.time()
        scene.frame_set(f)
        scene.render.filepath = os.path.join(os.path.abspath(a.out), f"f{f:05d}.jpg")
        bpy.ops.render.render(write_still=True)
        print(f"C2V frame {f} {time.time() - tf:.1f} s", flush=True)
    t_render = time.time() - t1
    meta = {"kind": "video", "frames": a.frames, "fps": a.fps, "w": a.width, "h": a.height, "dur": a.frames / a.fps,
            "params": params, "samples": a.samples, "blender": bpy.app.version_string,
            "build_s": round(t_build, 1), "render_s_per_frame": round(t_render / max(1, len(frames)), 2), "rendered": len(frames)}
    if measured is not None:
        meta["measure"] = measured
    with open(os.path.join(a.out, "meta.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    print("C2V_META " + json.dumps(meta))


if __name__ == "__main__":
    main()
