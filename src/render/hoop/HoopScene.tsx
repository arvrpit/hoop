// The hoop view: orthographic, top-down, 1 unit = 1 mm. Frames are drawn on demand: when the
// camera glides, a stitch animates, the look changes, or the pointer moves the intent layer.
import { OrthographicCamera, useFBO } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { camera } from '../../state/camera';
import { render } from '../../state/render';
import { useHoop } from '../../state/store';
import { tuning } from '../../tuning';
import { useOwnCamera } from '../useOwnCamera';
import { Background } from './Background';
import { Fabric } from './Fabric';
import { fitPxPerMm } from './framing';
import { HoopRing } from './HoopRing';
import { Knots } from './Knots';
import { shadowUniforms } from './materials';
import { stitchLayer } from './layerStore';
import { StitchShadows } from './StitchShadows';
import { Stitches } from './Stitches';
import { applyLighting, viewUniforms } from './uniforms';

declare global {
  interface Window {
    __hoopFrames?: number;
  }
}

/** Per frame: advance the camera, place it, light the scene. Runs before the shadow pass. */
function SceneDriver() {
  const cam = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    render.invalidate = () => invalidate();
    return () => {
      render.invalidate = () => {};
    };
  }, [invalidate]);
  useFrame(() => {
    const moving = camera.update(performance.now());
    const v = camera.view;
    const s = useHoop.getState();
    if (s.zoom !== v.zoom || s.focus.x !== v.focus.x || s.focus.y !== v.focus.y) {
      useHoop.setState({ zoom: v.zoom, focus: { ...v.focus } });
    }
    cam.zoom = fitPxPerMm(size.width, size.height, s.hoopDiameterMm) * v.zoom;
    cam.position.set(v.focus.x, v.focus.y, 500);
    cam.updateProjectionMatrix();
    viewUniforms.uMmPerPx.value = 1 / (cam.zoom * gl.getPixelRatio());
    applyLighting(useHoop.getState());
    const az = (s.keyAzimuthDeg * Math.PI) / 180;
    shadowUniforms.uShadowOffset.value
      .set(-Math.cos(az), -Math.sin(az))
      .multiplyScalar(tuning.stitchShadowOffsetMm);
    shadowUniforms.uShadowOpacity.value = tuning.stitchShadowOpacity;
    for (const fn of render.onFrame) fn();
    window.__hoopFrames = (window.__hoopFrames ?? 0) + 1;
    if (moving) invalidate();
  }, -2);
  return null;
}

export function HoopScene() {
  const layer = stitchLayer;
  const cam = useRef<THREE.OrthographicCamera>(null);
  useOwnCamera(cam);
  const invalidate = useThree((s) => s.invalidate);
  // Stitch shadows are soft, so the shadow pass renders at half resolution (4× fewer pixels).
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const shadowTarget = useFBO(
    Math.max(1, Math.round((size.width * dpr) / 2)),
    Math.max(1, Math.round((size.height * dpr) / 2)),
    { depthBuffer: false, samples: 0 },
  );

  useEffect(() => useHoop.subscribe(() => invalidate()), [invalidate]);

  useFrame(() => {
    if (layer.update(performance.now())) invalidate();
  }, -3);

  return (
    <>
      <OrthographicCamera ref={cam} makeDefault position={[0, 0, 500]} near={1} far={2000} zoom={1} />
      <SceneDriver />
      <StitchShadows target={shadowTarget} buffers={layer.buffers} threadTex={layer.table.texture} />
      <Background />
      <Fabric shadowTex={shadowTarget.texture} />
      <Stitches geometry={layer.buffers.stitches.geometry} threadTex={layer.table.texture} />
      <Knots geometry={layer.buffers.knots.geometry} threadTex={layer.table.texture} />
      <HoopRing />
    </>
  );
}
