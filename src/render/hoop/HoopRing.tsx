import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { hslToLinear } from '../../model/color';
import { useHoop } from '../../state/store';
import { tuning } from '../../tuning';
import { shaders } from '../shaders';
import { lightingUniforms, viewUniforms } from './uniforms';

export function HoopRing() {
  const diameter = useHoop((s) => s.hoopDiameterMm);
  const inner = diameter / 2;
  const outer = inner + tuning.hoopRingWidthMm;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shaders.hoopRing.vertex,
        fragmentShader: shaders.hoopRing.fragment,
        uniforms: {
          ...lightingUniforms,
          ...viewUniforms,
          uWoodColor: { value: new THREE.Vector3().fromArray(hslToLinear(tuning.hoopWoodColor)) },
          uInnerR: { value: inner },
          uOuterR: { value: outer },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [inner, outer],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={4}>
      <ringGeometry args={[inner - 0.5, outer + 0.5, 360, 1]} />
    </mesh>
  );
}
