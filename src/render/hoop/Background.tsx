import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { hslToLinear } from '../../model/color';
import { useHoop } from '../../state/store';
import { tuning } from '../../tuning';
import { shaders } from '../shaders';
import { lightingUniforms, viewUniforms } from './uniforms';

export function Background() {
  const diameter = useHoop((s) => s.hoopDiameterMm);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shaders.background.vertex,
        fragmentShader: shaders.background.fragment,
        uniforms: {
          ...lightingUniforms,
          ...viewUniforms,
          uTableColor: { value: new THREE.Vector3().fromArray(hslToLinear(tuning.tableColor)) },
          uVignette: { value: tuning.tableVignette },
          uOuterR: { value: diameter / 2 + tuning.hoopRingWidthMm },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [diameter],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={0} position={[0, 0, -1]}>
      <planeGeometry args={[8000, 8000]} />
    </mesh>
  );
}
