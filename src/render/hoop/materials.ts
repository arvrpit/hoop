// ShaderMaterial factories for the hoop view. All share the lighting/view uniform objects.
import * as THREE from 'three';
import { knotSizeFactor, tuning } from '../../tuning';
import { shaders } from '../shaders';
import { lightingUniforms, viewUniforms } from './uniforms';

const layered = { depthTest: false, depthWrite: false } as const;

/** Depth step between consecutive stitches (mm along z; invisible in the top-down orthographic view). */
export const STITCH_Z_STEP = 0.0004;

function stitchInstanceUniforms(threadTex: THREE.Texture) {
  return {
    ...viewUniforms,
    uThreadTex: { value: threadTex },
    uJitterWidth: { value: tuning.jitterWidth },
    uJitterLightness: { value: tuning.jitterLightness },
    uJitterEndpoint: { value: tuning.jitterEndpointMm },
    uWidthScale: { value: 1 },
    uZStep: { value: STITCH_Z_STEP },
    uCoreOnly: { value: 0 },
    uEndTaper: { value: tuning.endTaperMm },
  };
}

/**
 * Visible stitches. Drawn in creation order with blending (painter's order: later on top), but
 * depth-tested against the pre-pass so threads hidden under another thread's body are skipped.
 */
export function createStitchMaterial(threadTex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shaders.stitch.vertex,
    fragmentShader: shaders.stitch.fragment,
    uniforms: {
      ...lightingUniforms,
      ...stitchInstanceUniforms(threadTex),
      uEndDarken: { value: tuning.endDarken },
      uOpacity: { value: 1 },
      uOutputMode: { value: 0 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: -2,
  });
}

/** Depth pre-pass: writes depth where a thread body fully covers the pixel; no colour. */
export function createStitchDepthMaterial(threadTex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shaders.stitchDepth.vertex,
    fragmentShader: shaders.stitchDepth.fragment,
    uniforms: {
      ...stitchInstanceUniforms(threadTex),
      uJitterLightness: { value: 0 },
      uCoreOnly: { value: 1 },
    },
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
  });
}

export function createKnotMaterial(threadTex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shaders.knot.vertex,
    fragmentShader: shaders.knot.fragment,
    uniforms: {
      ...lightingUniforms,
      ...viewUniforms,
      uThreadTex: { value: threadTex },
      uKnotSize: { value: knotSizeFactor },
      uJitterWidth: { value: tuning.jitterWidth },
      uJitterLightness: { value: tuning.jitterLightness },
      uOpacity: { value: 1 },
      uOutputMode: { value: 0 },
    },
    transparent: true,
    ...layered,
  });
}

const maxBlend = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.MaxEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  transparent: true,
  ...layered,
} as const;

export const shadowUniforms = {
  uShadowOffset: { value: new THREE.Vector2(0.2, -0.2) },
  uShadowBlur: { value: tuning.stitchShadowBlurMm },
  uShadowOpacity: { value: tuning.stitchShadowOpacity },
  uContactOpacity: { value: tuning.contactShadowOpacity },
};

export function createStitchShadowMaterial(threadTex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shaders.stitchShadow.vertex,
    fragmentShader: shaders.stitchShadow.fragment,
    uniforms: {
      ...viewUniforms,
      ...shadowUniforms,
      uThreadTex: { value: threadTex },
      uJitterWidth: { value: tuning.jitterWidth },
      uJitterEndpoint: { value: tuning.jitterEndpointMm },
      uWidthScale: { value: 1 },
    },
    ...maxBlend,
  });
}

export function createKnotShadowMaterial(threadTex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shaders.knotShadow.vertex,
    fragmentShader: shaders.knotShadow.fragment,
    uniforms: {
      ...viewUniforms,
      ...shadowUniforms,
      uThreadTex: { value: threadTex },
      uKnotSize: { value: knotSizeFactor },
    },
    ...maxBlend,
  });
}

export function createDimpleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shaders.dimple.vertex,
    fragmentShader: shaders.dimple.fragment,
    uniforms: { ...viewUniforms },
    ...maxBlend,
  });
}
