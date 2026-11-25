// Draws the design (image + pen strokes) into a canvas in hoop space, clipped to the hoop circle.
// The same texture is traced on the fabric in the hoop view and shown inside the hoop on products.
import * as THREE from 'three';
import { penColor, useDesign, type PlacedImage } from '../../state/design';
import { guideUniforms } from '../hoop/uniforms';
import { render } from '../../state/render';

const PX = 2048;

class DesignLayer {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  sizeMm = 150;
  private img: HTMLImageElement | null = null;
  private imgSrc = '';
  private listeners = new Set<() => void>();

  constructor() {
    this.canvas.width = this.canvas.height = PX;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    guideUniforms.uGuideTex.value = this.texture;
    useDesign.subscribe(() => this.redraw());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setHoop(diameterMm: number): void {
    if (diameterMm === this.sizeMm) return;
    this.sizeMm = diameterMm;
    this.redraw();
  }

  /** True when there is anything to show. */
  get hasContent(): boolean {
    const d = useDesign.getState();
    return d.strokes.length > 0 || d.image !== null;
  }

  redraw(): void {
    const d = useDesign.getState();
    const g = this.canvas.getContext('2d')!;
    const k = PX / this.sizeMm;
    g.clearRect(0, 0, PX, PX);
    g.save();
    g.beginPath();
    g.arc(PX / 2, PX / 2, (this.sizeMm / 2) * k, 0, Math.PI * 2);
    g.clip();
    if (d.image) this.drawImage(g, d.image, k);
    for (const s of d.strokes) {
      if (s.points.length === 0) continue;
      g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      g.strokeStyle = penColor;
      g.fillStyle = penColor;
      g.lineWidth = s.widthMm * k;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      const p0 = s.points[0]!;
      g.moveTo((p0.x + this.sizeMm / 2) * k, (this.sizeMm / 2 - p0.y) * k);
      if (s.points.length === 1) g.lineTo((p0.x + this.sizeMm / 2) * k + 0.01, (this.sizeMm / 2 - p0.y) * k);
      for (const p of s.points.slice(1)) g.lineTo((p.x + this.sizeMm / 2) * k, (this.sizeMm / 2 - p.y) * k);
      g.stroke();
    }
    g.restore();
    this.texture.needsUpdate = true;
    guideUniforms.uGuideSize.value = this.sizeMm;
    guideUniforms.uGuideOn.value = d.visible && this.hasContent ? 1 : 0;
    guideUniforms.uGuideOpacity.value = d.opacity;
    for (const fn of this.listeners) fn();
    render.invalidate();
  }

  private drawImage(g: CanvasRenderingContext2D, im: PlacedImage, k: number): void {
    if (this.imgSrc !== im.src) {
      this.imgSrc = im.src;
      const el = new Image();
      el.onload = () => {
        this.img = el;
        this.redraw();
      };
      el.src = im.src;
      this.img = null;
      return;
    }
    if (!this.img) return;
    const w = im.widthMm * k;
    const h = w * (im.pxH / im.pxW);
    g.save();
    g.translate((im.x + this.sizeMm / 2) * k, (this.sizeMm / 2 - im.y) * k);
    g.rotate((im.rotationDeg * Math.PI) / 180);
    g.drawImage(this.img, -w / 2, -h / 2, w, h);
    g.restore();
  }
}

export const designLayer = new DesignLayer();

/** Read a PNG / JPEG / SVG file into a data URL (large images are scaled down to 2048 px). */
export async function loadImageFile(file: File): Promise<{ src: string; pxW: number; pxH: number }> {
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const el = new Image();
  await new Promise<void>((resolve, reject) => {
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('That file could not be read as an image.'));
    el.src = url;
  });
  let w = el.naturalWidth || 1000;
  let h = el.naturalHeight || 1000;
  const max = 2048;
  if (w > max || h > max || file.type === 'image/svg+xml') {
    // Rasterise (SVG) or shrink (huge photos) once, so the design stays light.
    const s = Math.min(1, max / Math.max(w, h)) || 1;
    const scale = file.type === 'image/svg+xml' ? max / Math.max(w, h) : s;
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height);
    w = c.width;
    h = c.height;
    return { src: c.toDataURL('image/png'), pxW: w, pxH: h };
  }
  return { src: url, pxW: w, pxH: h };
}
