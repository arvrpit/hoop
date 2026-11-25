import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bakeEmbroidery, treeDesign } from './embroidery.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') || 'front';
const [sh, ss, sl] = (q.get('color') || '40,18,90').split(',').map(Number);
const interactive = q.has('interactive');
const MODEL_URL = q.get('model') || '../t_shirt.glb';

// Placement in the shirt's own pattern space. The model's UVs are flat
// pattern coordinates in millimetres (v grows downward), so the embroidery is
// placed exactly like real garment embroidery: on the flat front panel.
const PLACE = { cx: 0, cy: -182, size: 140 };   // mm; cy=-182 ≈ mid-chest

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
{ // soft studio backdrop
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 220, 40, 256, 256, 380);
  grd.addColorStop(0, '#f4f1ec'); grd.addColorStop(1, '#d9d4cc');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const key = new THREE.DirectionalLight(0xfff1e2, 2.0);
key.position.set(-0.9, 2.3, 1.5);
key.target.position.set(0, 1.3, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -0.5, right: 0.5, top: 0.5, bottom: -0.5, near: 0.5, far: 4 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.003; key.shadow.radius = 4;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xe8eeff, 0.5);
rim.position.set(1.2, 1.8, -1.0); scene.add(rim);

const cam = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.01, 20);
const VIEWS = {
  front: { pos: [0, 1.31, 1.78], at: [0, 1.29, 0] },
  three: { pos: [Math.sin(0.5) * 1.78, 1.38, Math.cos(0.5) * 1.78], at: [0, 1.29, 0] },
  close: { pos: [0.075, 1.47, 0.43], at: [0, 1.43, 0.1] },
};
const v = VIEWS[view] || VIEWS.front;
cam.position.set(...v.pos); cam.lookAt(...v.at);

// ---- jersey knit texture (tiles in mm via the model's mm UVs) ----
function knitTextures() {
  const px = 256, N = px * px, nrm = new Uint8Array(N * 4), alb = new Uint8Array(N * 4);
  const wales = 5, courses = 6;           // tile = 4.25 mm x 3.9 mm
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const sx = (x / px) * wales, sy = (y / px) * courses;
    const s = sx - Math.floor(sx), t = sy - Math.floor(sy);
    // two legs of a V loop per wale
    const legs = [[0.08, 0.46], [0.92, 0.54]];
    let h = 0, gx = 0;
    for (const [x0, x1] of legs) {
      const cxl = x0 + (x1 - x0) * t, d = (s - cxl) / 0.2;
      if (Math.abs(d) < 1) { const hh = Math.sqrt(1 - d * d); if (hh > h) { h = hh; gx = -d; } }
    }
    const i = (y * px + x) * 4;
    const n = [gx * 0.9, (t - 0.5) * 0.25 * h, 0.6 + h * 0.4]; const l = Math.hypot(...n);
    nrm[i] = (n[0] / l * 0.5 + 0.5) * 255; nrm[i + 1] = (n[1] / l * 0.5 + 0.5) * 255; nrm[i + 2] = (n[2] / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
    const a = 200 + h * 55; alb[i] = alb[i + 1] = alb[i + 2] = a; alb[i + 3] = 255;
  }
  const mk = (d, cs) => { const t = new THREE.DataTexture(d, px, px); t.colorSpace = cs; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 4.25, 1 / 3.9); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true; return t; };
  return { normal: mk(nrm, THREE.NoColorSpace), albedo: mk(alb, THREE.SRGBColorSpace) };
}
const knit = knitTextures();
const shirtColor = new THREE.Color().setHSL(sh / 360, ss / 100, sl / 100, THREE.SRGBColorSpace);
const shirtMat = new THREE.MeshPhysicalMaterial({
  color: shirtColor, map: knit.albedo, normalMap: knit.normal, normalScale: new THREE.Vector2(0.55, 0.55),
  roughness: 0.93, sheen: 0.6, sheenRoughness: 0.75, sheenColor: shirtColor.clone().lerp(new THREE.Color(1, 1, 1), 0.6),
});

// ---- embroidery maps ----
const t0 = performance.now();
const emb = bakeEmbroidery({ sizeMm: PLACE.size, px: 2560, design: treeDesign(1.4) });
console.log('bake ms', Math.round(performance.now() - t0));
function embTex(data, cs) {
  const t = new THREE.DataTexture(data, emb.px, emb.px); t.colorSpace = cs;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.repeat.set(1 / PLACE.size, -1 / PLACE.size);
  t.offset.set(-(PLACE.cx - PLACE.size / 2) / PLACE.size, (PLACE.cy + PLACE.size / 2) / PLACE.size);
  t.needsUpdate = true; return t;
}
const embMat = new THREE.MeshPhysicalMaterial({
  map: embTex(emb.albedo, THREE.SRGBColorSpace), normalMap: embTex(emb.normal, THREE.NoColorSpace),
  anisotropyMap: embTex(emb.aniso, THREE.NoColorSpace), anisotropy: 0.65,
  roughness: 0.42, sheen: 0.25, sheenRoughness: 0.5, transparent: true, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
});

new GLTFLoader().load(MODEL_URL, (gltf) => {
  const root = gltf.scene;
  // drop Sketchfab's display rotation: mesh space is already Y-up, front = +Z, metres
  for (const name of ['Sketchfab_model', 'GLTF_SceneRootNode']) {
    const o = root.getObjectByName(name); if (o) { o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1); }
  }
  let front = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = shirtMat; o.castShadow = o.receiveShadow = true;
    if (o.name === 'Object_10') front = o;   // outer face of the front panel
  });
  scene.add(root);
  if (front) {
    // overlay patch: only triangles whose UVs touch the embroidery square
    const g = front.geometry, uv = g.attributes.uv, idx = g.index.array;
    const m = 3, x0 = PLACE.cx - PLACE.size / 2 - m, x1 = PLACE.cx + PLACE.size / 2 + m;
    const y0 = PLACE.cy - PLACE.size / 2 - m, y1 = PLACE.cy + PLACE.size / 2 + m;
    const keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      let inside = false;
      for (let k = 0; k < 3; k++) { const u = uv.getX(idx[i + k]), vv = uv.getY(idx[i + k]); if (u > x0 && u < x1 && vv > y0 && vv < y1) inside = true; }
      if (inside) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    const patch = g.clone(); patch.setIndex(keep);
    const mesh = new THREE.Mesh(patch, embMat); mesh.receiveShadow = true; mesh.renderOrder = 2;
    front.add(mesh);
    console.log('patch tris', keep.length / 3);
  }
  if (interactive) {
    const oc = new OrbitControls(cam, renderer.domElement); oc.target.set(...v.at); oc.enableDamping = true;
    renderer.setAnimationLoop(() => { oc.update(); renderer.render(scene, cam); });
  } else {
    renderer.render(scene, cam); renderer.render(scene, cam);
    window.__ready = true;
  }
}, undefined, (e) => { console.error(e); window.__error = String(e); });

addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
