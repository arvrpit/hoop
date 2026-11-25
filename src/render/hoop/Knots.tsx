import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { createKnotMaterial } from './materials';

export function Knots({
  geometry,
  threadTex,
}: {
  geometry: THREE.InstancedBufferGeometry;
  threadTex: THREE.Texture;
}) {
  const material = useMemo(() => createKnotMaterial(threadTex), [threadTex]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
