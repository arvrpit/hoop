// Product models in millimetres, each with "panels" whose UVs are mm (u right, v down) so the hoop
// sits at true size. All three are the owner's Sketchfab GLBs (credits in products.ts).
import * as THREE from 'three';
import { knitTextures, weaveTextures } from './textures';

export interface ProductModel {
  root: THREE.Object3D;
  panels: Record<string, THREE.Mesh>;
  /** Apply the product colour (each model decides which parts take it). */
  setColor: (c: THREE.Color) => void;
}

let knit: ReturnType<typeof knitTextures> | null = null;
const weaves = new Map<string, ReturnType<typeof weaveTextures>>();
const weave = (pitch: number, slub: number) => {
  const key = `${pitch}-${slub}`;
  if (!weaves.has(key)) weaves.set(key, weaveTextures(pitch, slub));
  return weaves.get(key)!;
};

/** The supplied T-shirt (spec 9.3.1): drop Sketchfab's display rotation, metres → mm, our knit. */
export function prepareTShirt(scene: THREE.Object3D): ProductModel {
  knit ??= knitTextures();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: knit.albedo,
    normalMap: knit.normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.93,
    sheen: 0.6,
    sheenRoughness: 0.75,
    side: THREE.DoubleSide,
  });
  for (const name of ['Sketchfab_model', 'GLTF_SceneRootNode']) {
    const o = scene.getObjectByName(name);
    if (o) {
      o.position.set(0, 0, 0);
      o.quaternion.identity();
      o.scale.set(1, 1, 1);
    }
  }
  scene.scale.setScalar(1000);
  const meshes: Record<string, THREE.Mesh> = {};
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const m = o as THREE.Mesh;
    m.material = mat;
    meshes[m.name] = m;
  });
  // Outer faces of the front and back panels (the back's outer face is the one facing -Z).
  const front = meshes['Object_10']!;
  const avgZ = (m: THREE.Mesh) => {
    const n = m.geometry.getAttribute('normal');
    let z = 0;
    for (let i = 0; i < n.count; i++) z += n.getZ(i);
    return z / n.count;
  };
  const back = ['Object_14', 'Object_15', 'Object_16']
    .map((k) => meshes[k])
    .filter((m): m is THREE.Mesh => !!m)
    .sort((a, b) => avgZ(a) - avgZ(b))[0]!;
  // Only the two panels take pointer hits (cheap raycasts on a 238k-triangle model).
  for (const m of Object.values(meshes)) if (m !== front && m !== back) m.raycast = () => {};
  return { root: scene, panels: { front, back }, setColor: (c) => mat.color.copy(c) };
}

// ---------------------------------------------------------------------------------------------
// Shared helpers for the tote and notebook: bake each mesh into product millimetres (identity
// transforms, so nothing in the cached glTF scene is changed), and give fabric parts mm UVs.

interface Part {
  name: string;
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
}

/** Every mesh of a glTF scene as a fresh geometry in scene space × `scale`. */
function bakeParts(scene: THREE.Object3D, scale: number): Part[] {
  scene.updateMatrixWorld(true);
  const toScene = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const s = new THREE.Matrix4().makeScale(scale, scale, scale);
  const out: Part[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(s, toScene).multiply(m.matrixWorld));
    out.push({ name: m.name, material: m.material as THREE.Material, geometry: g });
  });
  return out;
}

/** Rescale existing UVs so one UV unit is one millimetre on average (keeps the artist's unwrap). */
function uvsToMm(g: THREE.BufferGeometry): void {
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  let world = 0;
  let flat = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  eachTri(g, (i, j, k) => {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, j);
    c.fromBufferAttribute(pos, k);
    world += b.sub(a).cross(c.sub(a)).length() / 2;
    flat +=
      Math.abs(
        (uv.getX(j) - uv.getX(i)) * (uv.getY(k) - uv.getY(i)) -
          (uv.getX(k) - uv.getX(i)) * (uv.getY(j) - uv.getY(i)),
      ) / 2;
  });
  const f = flat > 0 ? Math.sqrt(world / flat) : 1;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * f, uv.getY(i) * f);
  uv.needsUpdate = true;
  g.deleteAttribute('tangent'); // tangents were for the old UVs
}

/** Flat panel UVs in mm: u to the right, v down, centred on the panel. */
function planarMm(g: THREE.BufferGeometry): void {
  g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(new THREE.Vector3());
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) - c.x;
    uv[i * 2 + 1] = -(pos.getY(i) - c.y);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.deleteAttribute('tangent');
}

/** Per-triangle box projection in mm (non-indexed geometry): for small cloth parts with no unwrap. */
function boxMm(g: THREE.BufferGeometry): void {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k]!;
      const [u, v] = az >= ax && az >= ay ? [p.x, -p.y] : ax >= ay ? [p.z, -p.y] : [p.x, p.z];
      uv[(t + k) * 2] = u;
      uv[(t + k) * 2 + 1] = v;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.deleteAttribute('tangent');
}

function eachTri(g: THREE.BufferGeometry, f: (a: number, b: number, c: number) => void): void {
  const idx = g.index;
  const n = idx ? idx.count : g.getAttribute('position').count;
  for (let i = 0; i < n; i += 3) {
    if (idx) f(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    else f(i, i + 1, i + 2);
  }
}

/** A new non-indexed geometry holding only some triangles of a non-indexed one (each given by its first vertex). */
function subset(g: THREE.BufferGeometry, firstVerts: number[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [name, at] of Object.entries(g.attributes)) {
    const size = at.itemSize;
    const src = at.array as Float32Array;
    const dst = new Float32Array(firstVerts.length * 3 * size);
    firstVerts.forEach((v, i) => dst.set(src.subarray(v * size, (v + 3) * size), i * 3 * size));
    out.setAttribute(name, new THREE.BufferAttribute(dst, size));
  }
  return out;
}

/** Floor the model (bottom at y = 0) and centre it on x and z. */
function floor(root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);
}

const noRaycast = () => {};

// ---------------------------------------------------------------------------------------------

/** Real width of the tote body, mm (the model is in arbitrary units). */
const TOTE_WIDTH_MM = 380;

/**
 * Tote bag (MoonOctopus, CC BY 4.0). Its front is a separate mesh ("Mat_Truoc_Tui": front of bag)
 * with a clean 0–1 unwrap, which becomes the embroidery panel with flat mm UVs. The body and handles
 * get canvas; the seam threads ("Chi") take a darker shade of the bag colour.
 */
export function prepareTote(scene: THREE.Object3D): ProductModel {
  const probe = bakeParts(scene, 1);
  const frontProbe = probe.find((p) => p.material.name.startsWith('Mat_Truoc_Tui'));
  if (!frontProbe) throw new Error('tote.glb: no front panel (material "Mat_Truoc_Tui")');
  frontProbe.geometry.computeBoundingBox();
  const unitsWide = frontProbe.geometry.boundingBox!.max.x - frontProbe.geometry.boundingBox!.min.x;
  for (const p of probe) p.geometry.dispose();

  const tex = weave(1 / 1.4, 0.12);
  const cloth = new THREE.MeshStandardMaterial({
    map: tex.albedo,
    normalMap: tex.normal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const thread = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide });
  const root = new THREE.Group();
  root.name = 'tote';
  let front: THREE.Mesh | null = null;
  for (const p of bakeParts(scene, TOTE_WIDTH_MM / unitsWide)) {
    const isThread = p.material.name.startsWith('Chi');
    const isFront = p.material.name.startsWith('Mat_Truoc_Tui');
    if (isFront) planarMm(p.geometry);
    else if (!isThread) uvsToMm(p.geometry);
    const mesh = new THREE.Mesh(p.geometry, isThread ? thread : cloth);
    mesh.name = isFront ? 'tote-front' : p.name;
    if (isFront) front = mesh;
    else mesh.raycast = noRaycast;
    root.add(mesh);
  }
  floor(root);
  return {
    root,
    panels: { front: front! },
    setColor: (c) => {
      cloth.color.copy(c);
      thread.color.copy(c).multiplyScalar(0.62);
    },
  };
}

/** The scan is in centimetres. */
const NOTEBOOK_MM_PER_UNIT = 10;

/**
 * Notebook (SCANIMAT, CC BY 4.0): a photo scan lying flat, front cover facing +Y, one mesh with a
 * texture atlas. Stood upright (front cover facing the viewer), then split by the scan's own colour:
 * the brown leather cover becomes linen book cloth (so the swatches work), and the cream page block
 * keeps the scan. The front cover is the embroidery panel.
 */
export function prepareNotebook(scene: THREE.Object3D): ProductModel {
  const [part] = bakeParts(scene, NOTEBOOK_MM_PER_UNIT);
  if (!part) throw new Error('notebook.glb: no mesh');
  // Lying flat (y = thickness, z = height) → standing: x' = −x, y' = z, z' = y.
  const stand = new THREE.Matrix4().set(-1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const g = part.geometry.applyMatrix4(stand).toNonIndexed();
  part.geometry.dispose();

  const scanMat = part.material as THREE.MeshStandardMaterial;
  const isCover = coverSampler(scanMat.map);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  g.computeBoundingBox();
  const zFront = g.boundingBox!.max.z;
  const frontTris: number[] = [];
  const clothTris: number[] = [];
  const pageTris: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    const u = (uv.getX(t) + uv.getX(t + 1) + uv.getX(t + 2)) / 3;
    const v = (uv.getY(t) + uv.getY(t + 1) + uv.getY(t + 2)) / 3;
    if (!isCover(u, v)) {
      pageTris.push(t);
      continue;
    }
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const zMid = (a.z + b.z + c.z) / 3;
    if (n.z > 0.6 && zMid > zFront - 12) frontTris.push(t);
    else clothTris.push(t);
  }
  const tex = weave(1 / 1.6, 0.35);
  const cloth = new THREE.MeshStandardMaterial({
    map: tex.albedo,
    normalMap: tex.normal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const frontGeom = subset(g, frontTris);
  planarMm(frontGeom);
  const clothGeom = subset(g, clothTris);
  boxMm(clothGeom);
  const pagesGeom = subset(g, pageTris);
  g.dispose();

  const front = new THREE.Mesh(frontGeom, cloth);
  front.name = 'notebook-front';
  const rest = new THREE.Mesh(clothGeom, cloth);
  const pages = new THREE.Mesh(pagesGeom, scanMat);
  rest.raycast = pages.raycast = noRaycast;
  const root = new THREE.Group();
  root.name = 'notebook';
  root.add(front, rest, pages);
  floor(root);
  return { root, panels: { front }, setColor: (col) => cloth.color.copy(col) };
}

/** Is this atlas spot part of the leather cover (dark brown) rather than the cream page block? */
function coverSampler(map: THREE.Texture | null): (u: number, v: number) => boolean {
  const img = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || typeof document === 'undefined') return () => true;
  const W = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, W);
  const px = ctx.getImageData(0, 0, W, W).data;
  // glTF UVs run from the top-left of the image (three keeps flipY off for glTF textures).
  const flip = map!.flipY;
  return (u, v) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
    const yy = Math.min(W - 1, Math.max(0, Math.floor((flip ? 1 - v : v) * W)));
    const i = (yy * W + x) * 4;
    const lum = (0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!) / 255;
    return lum < 0.5;
  };
}
