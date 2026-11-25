// Uniform objects shared by every hoop-view material, so fabric, threads, knots and the ring are
// always lit identically. Updated once per frame by <SceneDriver>.
import * as THREE from 'three';
import { hslToLinear } from '../../model/color';
import type { HoopState } from '../../state/store';
import { tuning } from '../../tuning';
import { lampState } from './Lamp';

export const lightingUniforms = {
  uAmbientColor: { value: new THREE.Vector3() },
  uKeyDir: { value: new THREE.Vector3(0, 0, 1) },
  uKeyColor: { value: new THREE.Vector3() },
  uLampPos: { value: new THREE.Vector3(0, 0, 150) },
  uLampColor: { value: new THREE.Vector3() },
  uLampRadius: { value: 140 },
  uEdgeDim: { value: 0 },
  uHoopInnerR: { value: 75 },
  uRingHeight: { value: tuning.hoopRingHeightMm },
  uViewDir: { value: new THREE.Vector3(0, 0, 1) },
  uThreadExposure: { value: tuning.threadExposure },
};

/** The traced design on the hoop fabric (set by the design layer). */
export const guideUniforms = {
  uGuideTex: { value: null as THREE.Texture | null },
  uGuideOn: { value: 0 },
  uGuideOpacity: { value: 0.6 },
  uGuideSize: { value: 150 },
};

export const viewUniforms = {
  uMmPerPx: { value: 0.1 },
};

const tmp = new THREE.Vector3();

export function applyLighting(s: HoopState): void {
  const u = lightingUniforms;
  const az = (s.keyAzimuthDeg * Math.PI) / 180;
  const el = (s.keyElevationDeg * Math.PI) / 180;
  u.uKeyDir.value.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)).normalize();
  u.uKeyColor.value.fromArray(hslToLinear(tuning.keyColor)).multiplyScalar(s.keyIntensity);
  u.uAmbientColor.value.fromArray(hslToLinear(tuning.ambientColor)).multiplyScalar(s.ambientIntensity);
  const lamp = lampState(s);
  u.uLampPos.value.set(lamp.x, lamp.y, lamp.height);
  u.uLampColor.value.copy(tmp.fromArray(hslToLinear(tuning.lampColor))).multiplyScalar(lamp.intensity);
  u.uLampRadius.value = lamp.radius;
  u.uEdgeDim.value = lamp.edgeDim;
  u.uHoopInnerR.value = s.hoopDiameterMm / 2;
  u.uThreadExposure.value = tuning.threadExposure;
  const tilt = (tuning.specViewTiltDeg * Math.PI) / 180;
  u.uViewDir.value.set(0, -Math.sin(tilt), Math.cos(tilt));
}
