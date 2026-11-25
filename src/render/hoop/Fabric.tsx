import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { hslToLinear } from '../../model/color';
import { useHoop } from '../../state/store';
import { fabrics } from '../../tuning';
import { shaders } from '../shaders';
import { guideUniforms, lightingUniforms, viewUniforms } from './uniforms';

const kinds = { cotton: 0, linen: 0, aida14: 1, felt: 2, jersey: 3, canvas: 0 } as const;
const size = new THREE.Vector2();

export function Fabric({ shadowTex }: { shadowTex: THREE.Texture }) {
  const fabric = useHoop((s) => s.fabric);
  const fabricColor = useHoop((s) => s.fabricColor);
  const shadows = useHoop((s) => s.shadows);
  const diameter = useHoop((s) => s.hoopDiameterMm);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shaders.fabric.vertex,
        fragmentShader: shaders.fabric.fragment,
        uniforms: {
          ...lightingUniforms,
          ...viewUniforms,
          uFabricKind: { value: 0 },
          uFabricColor: { value: new THREE.Vector3(0.8, 0.8, 0.8) },
          uThreadsPerMm: { value: 2 },
          uYarnWidth: { value: 0.9 },
          uYarnHeight: { value: 0.4 },
          uCrimp: { value: 0.2 },
          uColorVar: { value: 0.02 },
          uSlub: { value: 0 },
          uHoleSpacing: { value: 1 },
          uHoleSize: { value: 0 },
          uFibreScale: { value: 0.2 },
          uFabricSheen: { value: 0 },
          uShadowTex: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uShadowsOn: { value: 1 },
          uOutputMode: { value: 0 },
          ...guideUniforms,
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const f = fabrics[fabric];
    const u = material.uniforms;
    u.uFabricKind!.value = kinds[fabric];
    u.uFabricColor!.value.fromArray(hslToLinear(fabricColor));
    u.uThreadsPerMm!.value = f.threadsPerMm || 1;
    u.uYarnWidth!.value = f.yarnWidth;
    u.uYarnHeight!.value = f.yarnHeight;
    u.uCrimp!.value = f.crimp;
    u.uColorVar!.value = f.colorVariation;
    u.uSlub!.value = f.slub;
    u.uHoleSpacing!.value = f.holeSpacingMm;
    u.uHoleSize!.value = f.holeSizeMm;
    u.uFibreScale!.value = f.fibreScaleMm || 0.2;
    u.uFabricSheen!.value = f.sheen;
  }, [fabric, fabricColor, material]);

  useEffect(() => {
    material.uniforms.uShadowsOn!.value = shadows ? 1 : 0;
  }, [shadows, material]);

  useFrame(({ gl }) => {
    material.uniforms.uShadowTex!.value = shadowTex;
    gl.getDrawingBufferSize(size);
    material.uniforms.uResolution!.value.copy(size);
  });

  return (
    <mesh material={material} renderOrder={1}>
      <circleGeometry args={[diameter / 2 + 2, 256]} />
    </mesh>
  );
}
