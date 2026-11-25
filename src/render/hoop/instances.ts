// Growable instanced geometry: buffers double in size when full and only changed ranges upload (spec 6.4).
import * as THREE from 'three';

export interface AttrSpec {
  name: string;
  itemSize: number;
}

export class GrowableInstances {
  readonly geometry = new THREE.InstancedBufferGeometry();
  private specs: AttrSpec[];
  private capacity = 0;
  count = 0;

  constructor(base: THREE.BufferGeometry, specs: AttrSpec[], initialCapacity = 256) {
    this.specs = specs;
    this.geometry.index = base.index;
    this.geometry.setAttribute('position', base.getAttribute('position'));
    this.grow(initialCapacity);
    this.geometry.instanceCount = 0;
  }

  /** Make room for n instances (doubling), keeping existing data. */
  ensure(n: number): void {
    if (n <= this.capacity) return;
    let cap = Math.max(1, this.capacity);
    while (cap < n) cap *= 2;
    this.grow(cap);
  }

  array(name: string): Float32Array {
    return (this.geometry.getAttribute(name) as THREE.InstancedBufferAttribute).array as Float32Array;
  }

  /** Mark [start, end) instances as changed and set the drawn count. */
  commit(start: number, end: number, count: number): void {
    this.count = count;
    this.geometry.instanceCount = count;
    if (end <= start) return;
    for (const s of this.specs) {
      const attr = this.geometry.getAttribute(s.name) as THREE.InstancedBufferAttribute;
      attr.clearUpdateRanges();
      attr.addUpdateRange(start * s.itemSize, (end - start) * s.itemSize);
      attr.needsUpdate = true;
    }
  }

  dispose(): void {
    this.geometry.dispose();
  }

  private grow(cap: number): void {
    for (const s of this.specs) {
      const next = new Float32Array(cap * s.itemSize);
      const prev = this.geometry.getAttribute(s.name) as THREE.InstancedBufferAttribute | undefined;
      if (prev) next.set((prev.array as Float32Array).subarray(0, Math.min(prev.array.length, next.length)));
      const attr = new THREE.InstancedBufferAttribute(next, s.itemSize);
      attr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(s.name, attr);
    }
    this.capacity = cap;
  }
}

/** Unit quad along a stitch: x ∈ [0, 1] (a→b), y ∈ [-1, 1] (across). */
export function stitchQuad(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** Centred quad (-1..1) for knots and dimples. */
export function centredQuad(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
