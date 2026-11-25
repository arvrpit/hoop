// Thread swatches drawn with the real thread shader under the hoop's own lighting (spec 8.1, 8.2):
// a wound skein for each needle in the rack (made once, cached) and a satin patch for the picker's
// live preview (the light can sweep across it so sheen shows). Rendered offscreen with the app's
// WebGL renderer and copied into plain <canvas> elements, so no image URLs are needed.
import * as THREE from 'three';
import { hslToHex } from '../../model/color';
import type { Thread } from '../../model/types';
import { useHoop } from '../../state/store';
import { createStitchMaterial } from '../hoop/materials';
import { GrowableInstances, stitchQuad } from '../hoop/instances';
import { ThreadTable } from '../hoop/threadTable';
import { applyLighting, lightingUniforms, viewUniforms } from '../hoop/uniforms';

let renderer: THREE.WebGLRenderer | null = null;
const waiting = new Set<() => void>();

/** Called from inside the canvas once the WebGL renderer exists. */
export function setSwatchRenderer(gl: THREE.WebGLRenderer | null): void {
  renderer = gl;
  if (!gl) return;
  for (const fn of waiting) fn();
  waiting.clear();
}

/** Run `fn` once swatches can be drawn (now, or when the renderer arrives). Returns a cancel. */
export function whenSwatchesReady(fn: () => void): () => void {
  if (renderer) {
    fn();
    return () => {};
  }
  waiting.add(fn);
  return () => waiting.delete(fn);
}

type Kind = 'skein' | 'preview';
type Swatch = Pick<Thread, 'color' | 'material' | 'strands'>;

class SwatchRenderer {
  private table = new ThreadTable(2);
  private inst = new GrowableInstances(
    stitchQuad(),
    [
      { name: 'iAB', itemSize: 4 },
      { name: 'iMeta', itemSize: 4 },
    ],
    128,
  );
  private material = createStitchMaterial(this.table.texture);
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  private targets = new Map<number, THREE.WebGLRenderTarget>();
  private pixels = new Map<number, Uint8Array>();

  constructor() {
    this.material.depthTest = false;
    this.material.polygonOffset = false;
    const mesh = new THREE.Mesh(this.inst.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.cam.position.set(0, 0, 500);
  }

  /** Draw a swatch into `out` (px × px). `sweep` (0–1) moves the light across it. */
  draw(
    gl: THREE.WebGLRenderer,
    t: Swatch,
    kind: Kind,
    px: number,
    out: ImageData,
    sweep: number | null,
  ): void {
    applyLighting(useHoop.getState()); // the hoop's current light (also right before its first frame)
    const m = useHoop.getState().materials[t.material];
    const width = m.widthPerStrandMm * t.strands;
    this.table.update([{ ...t, id: 's', name: '' }], useHoop.getState().materials);

    // Skein: threads wound side by side across the swatch, scaled to the thread so every skein
    // shows the same number of turns. Preview: a satin patch at real size (8 mm), so strands show.
    const view = kind === 'skein' ? width * 7.5 : 8;
    const h = view / 2;
    const rows: [number, number, number, number][] = [];
    if (kind === 'skein') {
      const step = width * 0.92;
      const a = (-62 * Math.PI) / 180;
      const [dx, dy] = [Math.cos(a), Math.sin(a)];
      for (let o = -h * 1.6; o <= h * 1.6; o += step) {
        const cx = -dy * o;
        const cy = dx * o;
        rows.push([cx - dx * h * 2, cy - dy * h * 2, cx + dx * h * 2, cy + dy * h * 2]);
      }
    } else {
      const step = Math.max(width * 0.9, 0.3);
      const inset = h * 0.8;
      for (let x = -inset; x <= inset + 1e-6; x += step) rows.push([x - 0.35, -inset, x + 0.35, inset]);
    }
    this.inst.ensure(rows.length);
    const ab = this.inst.array('iAB');
    const meta = this.inst.array('iMeta');
    rows.forEach((r, i) => {
      ab.set(r, i * 4);
      meta.set([0, ((i * 0.6180339) % 1) * 0.9 + 0.05, i, 1], i * 4);
    });
    this.inst.commit(0, rows.length, rows.length);

    this.cam.left = -h;
    this.cam.right = h;
    this.cam.top = h;
    this.cam.bottom = -h;
    this.cam.updateProjectionMatrix();

    let rt = this.targets.get(px);
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(px, px, { depthBuffer: false });
      rt.texture.colorSpace = THREE.SRGBColorSpace; // the GPU encodes to sRGB on write
      this.targets.set(px, rt);
      this.pixels.set(px, new Uint8Array(px * px * 4));
    }

    const lamp = lightingUniforms.uLampPos.value;
    const prevLamp = lamp.clone();
    const prevEdge = lightingUniforms.uEdgeDim.value;
    const prevMm = viewUniforms.uMmPerPx.value;
    const prevTarget = gl.getRenderTarget();
    const prevClear = gl.getClearColor(new THREE.Color());
    const prevAlpha = gl.getClearAlpha();
    try {
      viewUniforms.uMmPerPx.value = view / px;
      lightingUniforms.uEdgeDim.value = 0;
      // The lamp hangs above the swatch, a little to the upper left; the sweep swings it across.
      const height = Math.max(prevLamp.z, 60);
      const s = sweep === null ? -0.35 : Math.sin(sweep * Math.PI * 2);
      lamp.set(s * height * 0.9, height * 0.35, height);
      const bg =
        kind === 'skein'
          ? new THREE.Color(hslToHex(t.color)).multiplyScalar(0.35)
          : new THREE.Color(0xefe6d8);
      gl.setClearColor(bg, 1);
      gl.setRenderTarget(rt);
      gl.clear(true, false, false);
      gl.render(this.scene, this.cam);
      const buf = this.pixels.get(px)!;
      gl.readRenderTargetPixels(rt, 0, 0, px, px, buf);
      // WebGL rows run bottom-up; ImageData rows top-down.
      for (let y = 0; y < px; y++) {
        out.data.set(buf.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4);
      }
    } finally {
      gl.setRenderTarget(prevTarget);
      gl.setClearColor(prevClear, prevAlpha);
      viewUniforms.uMmPerPx.value = prevMm;
      lightingUniforms.uEdgeDim.value = prevEdge;
      lamp.copy(prevLamp);
    }
  }
}

let swatches: SwatchRenderer | null = null;
const cache = new Map<string, ImageData>();

const key = (t: Swatch, kind: Kind, px: number) =>
  `${hslToHex(t.color)}|${t.material}|${t.strands}|${kind}|${px}`;

/**
 * Paint a thread swatch into a canvas. Returns false if it can't (no WebGL yet, or it failed), so
 * the caller keeps its plain fallback.
 */
export function paintSwatch(
  canvas: HTMLCanvasElement,
  t: Swatch,
  kind: Kind,
  sweep: number | null = null,
): boolean {
  const gl = renderer;
  const ctx = canvas.getContext('2d');
  if (!gl || !ctx) return false;
  const px = canvas.width;
  const k = key(t, kind, px);
  let img = sweep === null ? cache.get(k) : undefined;
  if (!img) {
    try {
      swatches ??= new SwatchRenderer();
      img = new ImageData(px, px);
      swatches.draw(gl, t, kind, px, img, sweep);
    } catch (e) {
      console.warn('Thread swatch failed', e);
      return false;
    }
    if (sweep === null) {
      if (cache.size > 200) cache.clear();
      cache.set(k, img);
    }
  }
  ctx.putImageData(img, 0, 0);
  return true;
}
