// Shadow pass: before the main render, draws stitch shadows, knot shadows and hole dimples into a
// screen-sized target (MAX blending). The fabric shader multiplies it in.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createDimpleMaterial, createKnotShadowMaterial, createStitchShadowMaterial } from './materials';
import type { PieceBuffers } from './pieceBuffers';
import { useHoop } from '../../state/store';

const clear = new THREE.Color();

export function StitchShadows({
  target,
  buffers,
  threadTex,
}: {
  target: THREE.WebGLRenderTarget;
  buffers: PieceBuffers;
  threadTex: THREE.Texture;
}) {
  const scene = useMemo(() => {
    const sc = new THREE.Scene();
    const meshes = [
      new THREE.Mesh(buffers.dimples.geometry, createDimpleMaterial()),
      new THREE.Mesh(buffers.stitches.geometry, createStitchShadowMaterial(threadTex)),
      new THREE.Mesh(buffers.knots.geometry, createKnotShadowMaterial(threadTex)),
    ];
    meshes.forEach((m, i) => {
      m.frustumCulled = false;
      m.renderOrder = i;
      sc.add(m);
    });
    return sc;
  }, [buffers, threadTex]);

  useEffect(
    () => () => {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      });
    },
    [scene],
  );

  useFrame(({ gl, camera }) => {
    if (!useHoop.getState().shadows) return;
    const prevTarget = gl.getRenderTarget();
    gl.getClearColor(clear);
    const prevAlpha = gl.getClearAlpha();
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(scene, camera);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(clear, prevAlpha);
  }, -1);

  return null;
}
