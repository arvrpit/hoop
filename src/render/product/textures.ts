// Small tileable fabric textures for products, in real millimetres (product UVs are mm).
import * as THREE from 'three';

function finish(data: Uint8Array, px: number, tileMm: [number, number], color: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(data, px, px);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tileMm[0], 1 / tileMm[1]);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Jersey knit: V-shaped loops (from the reference prototype). Tile = 5 × 6 loops of 0.7 mm. */
export function knitTextures(): { albedo: THREE.DataTexture; normal: THREE.DataTexture } {
  const px = 256;
  const N = px * px;
  const nrm = new Uint8Array(N * 4);
  const alb = new Uint8Array(N * 4);
  const wales = 5;
  const courses = 6;
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const sx = (x / px) * wales;
      const sy = (y / px) * courses;
      const s = sx - Math.floor(sx);
      const t = sy - Math.floor(sy);
      let h = 0;
      let gx = 0;
      for (const [x0, x1] of [
        [0.08, 0.46],
        [0.92, 0.54],
      ] as const) {
        const cx = x0 + (x1 - x0) * t;
        const d = (s - cx) / 0.2;
        if (Math.abs(d) < 1) {
          const hh = Math.sqrt(1 - d * d);
          if (hh > h) {
            h = hh;
            gx = -d;
          }
        }
      }
      const i = (y * px + x) * 4;
      const n = [gx * 0.9, (t - 0.5) * 0.25 * h, 0.6 + h * 0.4];
      const l = Math.hypot(n[0]!, n[1]!, n[2]!);
      nrm[i] = ((n[0]! / l) * 0.5 + 0.5) * 255;
      nrm[i + 1] = ((n[1]! / l) * 0.5 + 0.5) * 255;
      nrm[i + 2] = ((n[2]! / l) * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
      const a = 200 + h * 55;
      alb[i] = alb[i + 1] = alb[i + 2] = a;
      alb[i + 3] = 255;
    }
  return {
    albedo: finish(alb, px, [wales * 0.7, courses * 0.7], true),
    normal: finish(nrm, px, [wales * 0.7, courses * 0.7], false),
  };
}

/** Plain weave (canvas, linen book cloth). `yarns` per tile edge, `pitchMm` per yarn. */
export function weaveTextures(
  pitchMm: number,
  slub = 0,
): { albedo: THREE.DataTexture; normal: THREE.DataTexture } {
  const px = 256;
  const yarns = 8;
  const N = px * px;
  const nrm = new Uint8Array(N * 4);
  const alb = new Uint8Array(N * 4);
  const rnd = (n: number) => {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = (x / px) * yarns;
      const v = (y / px) * yarns;
      const i0 = Math.floor(u);
      const j0 = Math.floor(v);
      const fx = u - i0 - 0.5;
      const fy = v - j0 - 0.5;
      const ww = 0.44 * (1 + slub * (rnd(i0 * 3.1 + Math.floor(v / 3)) - 0.5));
      const wf = 0.44 * (1 + slub * (rnd(j0 * 5.7 + Math.floor(u / 3)) - 0.5));
      const over = (i0 + j0) % 2 === 0;
      const hw = Math.abs(fx) < ww ? Math.sqrt(1 - (fx / ww) ** 2) + (over ? 0.3 : 0) : -1;
      const hf = Math.abs(fy) < wf ? Math.sqrt(1 - (fy / wf) ** 2) + (over ? 0 : 0.3) : -1;
      let gx = 0;
      let gy = 0;
      let h = 0;
      if (hw >= hf && hw > 0) {
        h = hw;
        gx = -fx / ww;
      } else if (hf > 0) {
        h = hf;
        gy = -fy / wf;
      }
      const i = (y * px + x) * 4;
      const n = [gx * 0.8, gy * 0.8, 1];
      const l = Math.hypot(n[0]!, n[1]!, n[2]!);
      nrm[i] = ((n[0]! / l) * 0.5 + 0.5) * 255;
      nrm[i + 1] = ((n[1]! / l) * 0.5 + 0.5) * 255;
      nrm[i + 2] = ((n[2]! / l) * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
      const a = h > 0 ? 205 + Math.min(1, h) * 50 : 150;
      alb[i] = alb[i + 1] = alb[i + 2] = a;
      alb[i + 3] = 255;
    }
  const tile = yarns * pitchMm;
  return { albedo: finish(alb, px, [tile, tile], true), normal: finish(nrm, px, [tile, tile], false) };
}
