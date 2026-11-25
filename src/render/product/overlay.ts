// What the hoop looks like on a product while you set it up: a wooden ring at true size with the
// design inside it (clipped to the hoop), drawn into one canvas texture.
import * as THREE from 'three';
import { designLayer } from '../design/designCanvas';

export const RING_MM = 9;
const PX = 2048;

class ProductOverlay {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  hoopMm = 150;
  showRing = true;

  constructor() {
    this.canvas.width = this.canvas.height = PX;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    designLayer.onChange(() => this.redraw());
    this.redraw();
  }

  /** mm covered by the texture (hoop + ring + a little margin). */
  get sizeMm(): number {
    return this.hoopMm + 2 * RING_MM + 6;
  }

  set(hoopMm: number, showRing: boolean): void {
    if (hoopMm === this.hoopMm && showRing === this.showRing) return;
    this.hoopMm = hoopMm;
    this.showRing = showRing;
    this.redraw();
  }

  redraw(): void {
    const g = this.canvas.getContext('2d')!;
    const k = PX / this.sizeMm;
    const c = PX / 2;
    const r = (this.hoopMm / 2) * k;
    g.clearRect(0, 0, PX, PX);
    // Design, inside the hoop.
    g.drawImage(designLayer.canvas, c - r, c - r, 2 * r, 2 * r);
    if (!this.showRing) {
      this.texture.needsUpdate = true;
      return;
    }
    // Wooden ring: rounded band with grain-coloured gradient and a soft inner shadow.
    const w = RING_MM * k;
    const grad = g.createRadialGradient(c, c, r, c, c, r + w);
    grad.addColorStop(0, '#b98a57');
    grad.addColorStop(0.18, '#e1bf8f');
    grad.addColorStop(0.55, '#d6ae7b');
    grad.addColorStop(0.62, '#8a6440');
    grad.addColorStop(0.68, '#d9b383');
    grad.addColorStop(1, '#a7794a');
    g.beginPath();
    g.arc(c, c, r + w, 0, Math.PI * 2);
    g.arc(c, c, r, 0, Math.PI * 2, true);
    g.fillStyle = grad;
    g.fill();
    const sh = g.createRadialGradient(c, c, r - 4 * k, c, c, r);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(40,25,10,0.28)');
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.fillStyle = sh;
    g.fill();
    this.texture.needsUpdate = true;
  }
}

export const productOverlay = new ProductOverlay();
