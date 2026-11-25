import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildPanelInfo,
  hoopFits,
  nearestFit,
  patchGeometry,
  placeTexture,
  surfaceAt,
} from '../src/render/product/placement';

/** A flat 300 × 400 mm panel with mm UVs (u right, v down), centred on the origin, facing +z. */
function panel(): THREE.Mesh {
  const g = new THREE.PlaneGeometry(300, 400, 30, 40);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - 0.5) * 300, (0.5 - uv.getY(i)) * 400);
  return new THREE.Mesh(g);
}

describe('hoopFits', () => {
  const info = buildPanelInfo(panel());
  it('fits a hoop in the middle of the panel', () => {
    expect(hoopFits(info, 0, 0, 80)).toBe(true);
  });
  it('refuses a hoop wider than the panel', () => {
    expect(hoopFits(info, 0, 0, 160)).toBe(false);
  });
  it('refuses a hoop hanging over an edge', () => {
    expect(hoopFits(info, 120, 0, 50)).toBe(false);
    expect(hoopFits(info, 0, -180, 50)).toBe(false);
    expect(hoopFits(info, 95, 0, 50)).toBe(true);
  });
});

describe('nearestFit', () => {
  const info = buildPanelInfo(panel());
  it('keeps a spot that already fits', () => {
    expect(nearestFit(info, 10, 20, 50)).toEqual({ u: 10, v: 20 });
  });
  it('slides a hoop back inside when it hangs over an edge', () => {
    const fit = nearestFit(info, 130, 0, 50)!;
    expect(fit).not.toBeNull();
    expect(hoopFits(info, fit.u, fit.v, 50)).toBe(true);
    expect(fit.u).toBeLessThanOrEqual(101); // edge at 150 − 50, within the 2 mm coverage grid
    expect(Math.hypot(fit.u - 130, fit.v)).toBeLessThan(45);
  });
  it('gives up when no spot on the panel is big enough', () => {
    expect(nearestFit(info, 0, 0, 200)).toBeNull();
  });
});

describe('patchGeometry', () => {
  const mesh = panel();
  it('keeps only the triangles around the hoop, sharing the panel attributes', () => {
    const full = mesh.geometry.index!.count;
    const patch = patchGeometry(mesh, 0, 0, 50);
    const idx = patch.index!;
    expect(idx.count).toBeGreaterThan(0);
    expect(idx.count).toBeLessThan(full / 4);
    expect(idx.count % 3).toBe(0);
    expect(patch.getAttribute('uv')).toBe(mesh.geometry.getAttribute('uv'));
    const uv = patch.getAttribute('uv');
    for (let i = 0; i < idx.count; i += 3) {
      const us = [0, 1, 2].map((k) => uv.getX(idx.getX(i + k)));
      const vs = [0, 1, 2].map((k) => uv.getY(idx.getX(i + k)));
      expect(Math.max(...us)).toBeGreaterThanOrEqual(-50);
      expect(Math.min(...us)).toBeLessThanOrEqual(50);
      expect(Math.max(...vs)).toBeGreaterThanOrEqual(-50);
      expect(Math.min(...vs)).toBeLessThanOrEqual(50);
    }
  });
  it('covers the whole hoop square', () => {
    const patch = patchGeometry(mesh, 40, -60, 50);
    const info = buildPanelInfo(new THREE.Mesh(patch));
    expect(hoopFits(info, 40, -60, 49)).toBe(true);
  });
});

describe('surfaceAt', () => {
  it('finds the world point and normal under a UV spot (v grows downward)', () => {
    const mesh = panel();
    mesh.position.set(5, 0, -20);
    const s = surfaceAt(mesh, 100, -150)!;
    expect(s.point.x).toBeCloseTo(105, 3);
    expect(s.point.y).toBeCloseTo(150, 3);
    expect(s.point.z).toBeCloseTo(-20, 3);
    expect(s.normal.z).toBeCloseTo(1, 5);
  });
  it('returns null off the panel', () => {
    expect(surfaceAt(panel(), 400, 0)).toBeNull();
  });
});

describe('placeTexture', () => {
  it('maps the hoop square onto 0..1 with hoop up = texture up', () => {
    const t = new THREE.Texture();
    placeTexture(t, 30, -100, 150);
    t.updateMatrix();
    const at = (u: number, v: number) => new THREE.Vector2(u, v).applyMatrix3(t.matrix);
    const c = at(30, -100);
    expect(c.x).toBeCloseTo(0.5, 6);
    expect(c.y).toBeCloseTo(0.5, 6);
    const topRight = at(30 + 75, -100 - 75); // right and up on the panel (v down)
    expect(topRight.x).toBeCloseTo(1, 6);
    expect(topRight.y).toBeCloseTo(1, 6);
  });
});
