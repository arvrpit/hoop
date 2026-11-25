import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { createStitchDepthMaterial, createStitchMaterial } from './materials';

/**
 * All visible stitches as one instanced draw in creation order (later stitches on top), preceded by
 * a cheap depth pre-pass so only the top-most thread body at each pixel runs the full thread shader.
 */
export function Stitches({
  geometry,
  threadTex,
}: {
  geometry: THREE.InstancedBufferGeometry;
  threadTex: THREE.Texture;
}) {
  const material = useMemo(() => createStitchMaterial(threadTex), [threadTex]);
  const depth = useMemo(() => createStitchDepthMaterial(threadTex), [threadTex]);
  useEffect(
    () => () => {
      material.dispose();
      depth.dispose();
    },
    [material, depth],
  );
  return (
    <>
      <mesh geometry={geometry} material={depth} frustumCulled={false} renderOrder={1.5} />
      <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
    </>
  );
}
