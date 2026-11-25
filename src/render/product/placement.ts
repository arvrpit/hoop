// Hoop placement on a product panel. Panels carry UVs in real millimetres (u right, v down), so the
// hoop sits at true size and follows the fabric exactly, like embroidery done on the flat panel.
import * as THREE from 'three';

export interface PanelInfo {
  mesh: THREE.Mesh;
  u0: number;
  v0: number;
  cell: number;
  nu: number;
  nv: number;
  grid: Uint8Array; // 1 where the panel has fabric (rasterised from its UV triangles)
}

function tri(geometry: THREE.BufferGeometry, f: (a: number, b: number, c: number) => void): void {
  const idx = geometry.index;
  const n = idx ? idx.count : geometry.getAttribute('position').count;
  for (let i = 0; i < n; i += 3) {
    if (idx) f(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    else f(i, i + 1, i + 2);
  }
}

export function buildPanelInfo(mesh: THREE.Mesh, cell = 2): PanelInfo {
  const g = mesh.geometry;
  const uv = g.getAttribute('uv');
  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    u0 = Math.min(u0, uv.getX(i));
    u1 = Math.max(u1, uv.getX(i));
    v0 = Math.min(v0, uv.getY(i));
    v1 = Math.max(v1, uv.getY(i));
  }
  const nu = Math.ceil((u1 - u0) / cell) + 1;
  const nv = Math.ceil((v1 - v0) / cell) + 1;
  const grid = new Uint8Array(nu * nv);
  tri(g, (a, b, c) => {
    const ax = uv.getX(a),
      ay = uv.getY(a),
      bx = uv.getX(b),
      by = uv.getY(b),
      cx = uv.getX(c),
      cy = uv.getY(c);
    const minI = Math.max(0, Math.floor((Math.min(ax, bx, cx) - u0) / cell));
    const maxI = Math.min(nu - 1, Math.ceil((Math.max(ax, bx, cx) - u0) / cell));
    const minJ = Math.max(0, Math.floor((Math.min(ay, by, cy) - v0) / cell));
    const maxJ = Math.min(nv - 1, Math.ceil((Math.max(ay, by, cy) - v0) / cell));
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-9) return;
    for (let j = minJ; j <= maxJ; j++)
      for (let i = minI; i <= maxI; i++) {
        const px = u0 + i * cell;
        const py = v0 + j * cell;
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
        const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
        if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) grid[j * nu + i] = 1;
      }
  });
  return { mesh, u0, v0, cell, nu, nv, grid };
}

function covered(p: PanelInfo, u: number, v: number): boolean {
  const i = Math.round((u - p.u0) / p.cell);
  const j = Math.round((v - p.v0) / p.cell);
  return i >= 0 && j >= 0 && i < p.nu && j < p.nv && p.grid[j * p.nu + i] === 1;
}

/** Does a hoop of this radius (plus margin for the outer ring) sit fully on the panel? */
export function hoopFits(p: PanelInfo, u: number, v: number, radius: number): boolean {
  for (const r of [0, radius * 0.5, radius]) {
    const n = r === 0 ? 1 : 48;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      if (!covered(p, u + r * Math.cos(a), v + r * Math.sin(a))) return false;
    }
  }
  return true;
}

/** The nearest centre (searching outward) where the hoop fits, or null. */
export function nearestFit(
  p: PanelInfo,
  u: number,
  v: number,
  radius: number,
): { u: number; v: number } | null {
  if (hoopFits(p, u, v, radius)) return { u, v };
  for (let r = 4; r <= 160; r += 4) {
    const n = Math.max(8, Math.round(r / 2));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const cu = u + r * Math.cos(a);
      const cv = v + r * Math.sin(a);
      if (hoopFits(p, cu, cv, radius)) return { u: cu, v: cv };
    }
  }
  return null;
}

/** Triangles of the panel whose UVs touch the square around the hoop (for the overlay patch). */
export function patchGeometry(mesh: THREE.Mesh, cu: number, cv: number, half: number): THREE.BufferGeometry {
  const g = mesh.geometry;
  const uv = g.getAttribute('uv');
  const keep: number[] = [];
  const x0 = cu - half,
    x1 = cu + half,
    y0 = cv - half,
    y1 = cv + half;
  tri(g, (a, b, c) => {
    const us = [uv.getX(a), uv.getX(b), uv.getX(c)];
    const vs = [uv.getY(a), uv.getY(b), uv.getY(c)];
    if (Math.max(...us) < x0 || Math.min(...us) > x1 || Math.max(...vs) < y0 || Math.min(...vs) > y1) return;
    keep.push(a, b, c);
  });
  const patch = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const at = g.getAttribute(name);
    if (at) patch.setAttribute(name, at);
  }
  patch.setIndex(keep);
  return patch;
}

/** World position and normal of the panel at a UV point (for facing the camera to the hoop). */
export function surfaceAt(
  mesh: THREE.Mesh,
  u: number,
  v: number,
): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
  const g = mesh.geometry;
  const uv = g.getAttribute('uv');
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  let out: { point: THREE.Vector3; normal: THREE.Vector3 } | null = null;
  tri(g, (a, b, c) => {
    if (out) return;
    const ax = uv.getX(a),
      ay = uv.getY(a),
      bx = uv.getX(b),
      by = uv.getY(b),
      cx = uv.getX(c),
      cy = uv.getY(c);
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-9) return;
    const l1 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / d;
    const l2 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) return;
    const p = new THREE.Vector3()
      .fromBufferAttribute(pos, a)
      .multiplyScalar(l1)
      .add(new THREE.Vector3().fromBufferAttribute(pos, b).multiplyScalar(l2))
      .add(new THREE.Vector3().fromBufferAttribute(pos, c).multiplyScalar(l3));
    const n = new THREE.Vector3()
      .fromBufferAttribute(nor, a)
      .multiplyScalar(l1)
      .add(new THREE.Vector3().fromBufferAttribute(nor, b).multiplyScalar(l2))
      .add(new THREE.Vector3().fromBufferAttribute(nor, c).multiplyScalar(l3));
    mesh.updateWorldMatrix(true, false);
    out = {
      point: p.applyMatrix4(mesh.matrixWorld),
      normal: n.transformDirection(mesh.matrixWorld).normalize(),
    };
  });
  return out;
}

/** Texture transform so a texture covering `sizeMm` around (cu, cv) lands on the panel's mm UVs. */
export function placeTexture(t: THREE.Texture, cu: number, cv: number, sizeMm: number): void {
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / sizeMm, -1 / sizeMm);
  t.offset.set(-(cu - sizeMm / 2) / sizeMm, (cv + sizeMm / 2) / sizeMm);
  t.needsUpdate = true;
}
