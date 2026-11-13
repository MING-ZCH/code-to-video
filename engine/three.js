// three.js: render a glTF scene lit by an equirectangular HDRI, driven page-side by lib/three.mjs.
//
// Modes (same scene, camera, HDRI and colour pipeline: linear → sRGB, no tone mapping, as Blender's "Standard" view):
//   raster       physically based rasterisation, image-based lighting only (PMREM); no shadows from the environment
//   raster_gtao  the same plus ground-truth ambient occlusion (GTAOPass), the usual real-time contact-shadow stand-in
//   pt           path tracing (three-gpu-pathtracer), `spp` samples per pixel, `bounces` bounces
// The glTF export's Y-up conversion already lines Blender's world texture up with three's equirect lookup (envRot 0,
// checked by matching the visible background).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

const S = {};

async function init({ glb, hdr, w, h, bg = true, envRot = 0 }) {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const env = await new HDRLoader().loadAsync(hdr);
  env.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = env; if (bg) scene.background = env;
  scene.environmentRotation.set(0, envRot, 0); scene.backgroundRotation.set(0, envRot, 0);
  const gltf = await new GLTFLoader().loadAsync(glb);
  scene.add(gltf.scene);
  const camera = gltf.cameras[0];
  camera.aspect = w / h; camera.updateProjectionMatrix();
  scene.updateMatrixWorld(true);
  let meshes = 0; gltf.scene.traverse(o => { if (o.isMesh) meshes++; });
  Object.assign(S, { renderer, scene, camera, w, h });
  return { meshes, camera: { fov: camera.fov, near: camera.near, far: camera.far } };
}

async function render({ mode, spp = 256, bounces = 8 }) {
  const { renderer, scene, camera, w, h } = S, t0 = performance.now();
  if (mode === 'raster') renderer.render(scene, camera);
  else if (mode === 'raster_gtao') {
    const composer = new EffectComposer(renderer); composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, w, h); gtao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 });
    composer.addPass(gtao); composer.addPass(new OutputPass());
    composer.render();
  } else if (mode === 'pt') {
    const pt = new WebGLPathTracer(renderer);
    pt.renderDelay = 0; pt.fadeDuration = 0; pt.minSamples = 0; pt.dynamicLowRes = false; pt.rasterizeScene = false;
    pt.bounces = bounces; pt.tiles.set(2, 2);
    pt.setScene(scene, camera);                                   // BVH built on the main thread (no worker)
    const gl = renderer.getContext(), px = new Uint8Array(4);
    for (let guard = 0, last = -1; pt.samples < spp; guard++) {
      pt.renderSample();
      if (pt.isCompiling) await new Promise(r => setTimeout(r, 50));
      if (Math.floor(pt.samples) % 32 === 0 && Math.floor(pt.samples) !== last) {   // drain the GPU queue (a long queue trips the watchdog)
        last = Math.floor(pt.samples); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (gl.isContextLost()) throw new Error('WebGL context lost at sample ' + last);
        await new Promise(r => setTimeout(r, 0));
      }
      if (guard > spp * 50) throw new Error('path tracer made no progress');
    }
    pt.renderSample();                                            // the last call blits the accumulated image to the canvas
  } else throw new Error('unknown mode ' + mode);
  const gl = renderer.getContext(), px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);       // wait for the GPU before timing
  if (gl.isContextLost()) throw new Error('WebGL context lost');
  return { mode, ms: Math.round(performance.now() - t0) };
}

// ---------- interaction: rigid bodies with Rapier (deterministic build), rendered per frame ----------
// Dynamic pieces get convex-hull colliders, everything else static triangle meshes. mode "physics": the dropped piece
// falls and collides; mode "keyframed": it follows a straight line to its target as a keyframed animation would
// (kinematic body, contacts with static geometry switched on so the overlap can be measured). Every frame reports
// the deepest penetration among the contact manifolds.
let RAPIER;
async function simInit({ dynamic, drop, mode, fps = 24, substeps = 10, dur = 4 }) {
  RAPIER = RAPIER || (await import('@dimforge/rapier3d-deterministic-compat')).default;
  await RAPIER.init();
  const { scene } = S;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / (fps * substeps);
  const meshesOf = name => { const n = scene.getObjectByName(name), out = []; n?.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
  const dyn = new Map(dynamic.map(n => [n, meshesOf(n)]));
  const dynMeshes = new Set([...dyn.values()].flat());
  const worldVerts = m => { const p = m.geometry.attributes.position, v = new THREE.Vector3(), out = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); out.set([v.x, v.y, v.z], i * 3); } return out; };
  scene.traverse(o => {                                           // static world: triangle meshes in world space
    if (!o.isMesh || dynMeshes.has(o)) return;
    const idx = o.geometry.index ? new Uint32Array(o.geometry.index.array) : Uint32Array.from({ length: o.geometry.attributes.position.count }, (_, i) => i);
    world.createCollider(RAPIER.ColliderDesc.trimesh(worldVerts(o), idx).setFriction(0.8).setRestitution(0.2));
  });
  const bodies = [];
  for (const [name, ms] of dyn) {                                 // one body per piece, hull of all its meshes
    const all = ms.map(worldVerts), n = all.reduce((s, a) => s + a.length, 0), pts = new Float32Array(n); let o = 0;
    for (const a of all) { pts.set(a, o); o += a.length; }
    const c = new THREE.Vector3(); for (let i = 0; i < n; i += 3) c.add(new THREE.Vector3(pts[i], pts[i + 1], pts[i + 2])); c.divideScalar(n / 3);
    for (let i = 0; i < n; i += 3) { pts[i] -= c.x; pts[i + 1] -= c.y; pts[i + 2] -= c.z; }
    const isDrop = name === drop.name, kin = isDrop && mode === 'keyframed';
    const start = isDrop ? new THREE.Vector3(...drop.from) : c.clone();
    const desc = kin ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic().setAngularDamping(0.4).setLinearDamping(0.05);
    desc.setTranslation(start.x, start.y, start.z); if (isDrop && !kin) desc.setLinvel(...drop.vel);
    const body = world.createRigidBody(desc);
    const col = world.createCollider(RAPIER.ColliderDesc.convexHull(pts).setDensity(800).setFriction(0.8).setRestitution(0.3), body);
    if (kin) col.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
    const rel = ms.map(m => new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z).multiply(m.matrixWorld));
    ms.forEach(m => { m.matrixAutoUpdate = false; });
    bodies.push({ name, body, col, ms, rel, isDrop, kin, start, end: isDrop ? new THREE.Vector3(...drop.to) : null });
  }
  Object.assign(S, { world, bodies, simFps: fps, substeps, dur, frame: 0 });
  return { static: world.colliders.len() - bodies.length, dynamic: bodies.length };
}

function penetration() {
  let deepest = 0, pairs = 0;
  for (const b of S.bodies) S.world.contactPairsWith(b.col, other => {
    S.world.contactPair(b.col, other, manifold => {
      for (let i = 0; i < manifold.numContacts(); i++) deepest = Math.max(deepest, -manifold.contactDist(i));
      if (manifold.numContacts()) pairs++;
    });
  });
  return { depth_mm: +(1000 * deepest).toFixed(2), pairs };
}

async function simStep({ render = true } = {}) {
  const { world, bodies, simFps, substeps, dur } = S, f = S.frame++;
  for (let k = 0; k < substeps; k++) {
    const t = (f * substeps + k + 1) / (simFps * substeps);
    for (const b of bodies) if (b.kin) { const u = Math.min(1, t / dur * 1.6), p = b.start.clone().lerp(b.end, u * u * (3 - 2 * u)); b.body.setNextKinematicTranslation(p); }
    world.step();
  }
  for (const b of bodies) {
    const p = b.body.translation(), q = b.body.rotation();
    const M = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(q.x, q.y, q.z, q.w), new THREE.Vector3(1, 1, 1));
    b.ms.forEach((m, i) => { const W = M.clone().multiply(b.rel[i]); m.matrix.copy(m.parent.matrixWorld.clone().invert().multiply(W)); m.matrixWorldNeedsUpdate = true; });
  }
  const pen = penetration();
  if (render) {
    if (!S.composer) {
      const { renderer, scene, camera, w, h } = S;
      S.composer = new EffectComposer(renderer); S.composer.setSize(w, h);
      S.composer.addPass(new RenderPass(scene, camera));
      const gtao = new GTAOPass(scene, camera, w, h); gtao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 });
      S.composer.addPass(gtao); S.composer.addPass(new OutputPass());
    }
    S.composer.render();
  }
  const drop = bodies.find(b => b.isDrop).body.translation();
  return { frame: f, ...pen, drop: [drop.x, drop.y, drop.z].map(x => +x.toFixed(4)) };
}

window.C2V3 = { init, render, simInit, simStep, png: () => document.getElementById('c').toDataURL('image/png'),
  jpg: q => document.getElementById('c').toDataURL('image/jpeg', q),
  where: name => { const n = S.scene.getObjectByName(name); if (!n) return null; const b = new THREE.Box3().setFromObject(n); return { min: b.min.toArray(), max: b.max.toArray() }; } };
