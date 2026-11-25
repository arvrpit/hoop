// Packs threads into a small float texture the shaders read by index. Editing a thread's colour or
// material only rewrites its column here, so every stitch made with it recolours for free.
import * as THREE from 'three';
import { hslToLinear } from '../../model/color';
import type { Thread, ThreadMaterial } from '../../model/types';
import type { ThreadMaterialParams } from '../../tuning';

const ROWS = 4;

export class ThreadTable {
  readonly texture: THREE.DataTexture;
  private data: Float32Array;
  private capacity: number;
  private index = new Map<string, number>();

  constructor(capacity = 64) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * ROWS * 4);
    this.texture = new THREE.DataTexture(this.data, capacity, ROWS, THREE.RGBAFormat, THREE.FloatType);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;
  }

  indexOf(threadId: string): number {
    return this.index.get(threadId) ?? 0;
  }

  update(threads: Thread[], materials: Record<ThreadMaterial, ThreadMaterialParams>): void {
    if (threads.length > this.capacity) throw new Error('Too many threads for the thread table');
    this.index.clear();
    threads.forEach((t, i) => {
      this.index.set(t.id, i);
      const m = materials[t.material];
      const rgb = hslToLinear(t.color);
      this.write(i, 0, rgb[0], rgb[1], rgb[2], m.widthPerStrandMm * t.strands);
      this.write(i, 1, m.plies, m.twistPerMm, m.twistSlope, m.plyDepth);
      this.write(i, 2, m.sheen, m.specExponent, m.fuzz, m.fibre);
      this.write(i, 3, m.strandSplit, t.strands, m.flatten, m.roughness);
    });
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }

  private write(col: number, row: number, a: number, b: number, c: number, d: number): void {
    const o = (row * this.capacity + col) * 4;
    this.data[o] = a;
    this.data[o + 1] = b;
    this.data[o + 2] = c;
    this.data[o + 3] = d;
  }
}
