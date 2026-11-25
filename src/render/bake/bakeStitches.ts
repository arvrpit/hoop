// Bakes the stitches (no fabric, no hoop) into albedo + normal textures covering the hoop square,
// using the thread shader's albedo and normal output modes (spec 9.1). Shown on products as a patch
// with real relief. Colours are premultiplied by coverage; the product material un-premultiplies.
import * as THREE from 'three';
import { stitchLayer } from '../hoop/layerStore';
import { createKnotMaterial, createStitchMaterial } from '../hoop/materials';
import { viewUniforms } from '../hoop/uniforms';

const PX = 2048;

export interface Bake {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  sizeMm: number;
}

let targets: { albedo: THREE.WebGLRenderTarget; normal: THREE.WebGLRenderTarget } | null = null;

export function bakeStitches(gl: THREE.WebGLRenderer, sizeMm: number): Bake {
  const opts = {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  };
  targets ??= {
    albedo: new THREE.WebGLRenderTarget(PX, PX, opts),
    normal: new THREE.WebGLRenderTarget(PX, PX, opts),
  };
  stitchLayer.finishAnimations();
  const tex = stitchLayer.table.texture;
  const sMat = createStitchMaterial(tex);
  const kMat = createKnotMaterial(tex);
  for (const m of [sMat, kMat]) {
    m.depthTest = false;
    m.polygonOffset = false;
  }
  const scene = new THREE.Scene();
  const sMesh = new THREE.Mesh(stitchLayer.buffers.stitches.geometry, sMat);
  const kMesh = new THREE.Mesh(stitchLayer.buffers.knots.geometry, kMat);
  sMesh.frustumCulled = kMesh.frustumCulled = false;
  kMesh.renderOrder = 1;
  scene.add(sMesh, kMesh);
  const h = sizeMm / 2;
  const cam = new THREE.OrthographicCamera(-h, h, h, -h, 1, 2000);
  cam.position.set(0, 0, 500);

  const prevMm = viewUniforms.uMmPerPx.value;
  const prevTarget = gl.getRenderTarget();
  const prevClear = gl.getClearColor(new THREE.Color());
  const prevAlpha = gl.getClearAlpha();
  viewUniforms.uMmPerPx.value = sizeMm / PX;
  gl.setClearColor(0x000000, 0);
  for (const [mode, rt] of [
    [1, targets.albedo],
    [2, targets.normal],
  ] as const) {
    sMat.uniforms.uOutputMode!.value = mode;
    kMat.uniforms.uOutputMode!.value = mode;
    gl.setRenderTarget(rt);
    gl.clear(true, false, false);
    gl.render(scene, cam);
  }
  gl.setRenderTarget(prevTarget);
  gl.setClearColor(prevClear, prevAlpha);
  viewUniforms.uMmPerPx.value = prevMm;
  sMat.dispose();
  kMat.dispose();
  return { albedo: targets.albedo.texture, normal: targets.normal.texture, sizeMm };
}

/** Product material for the baked embroidery: un-premultiplies colour and normals. */
export function embroideryMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 embTexel = texture2D( map, vMapUv );
          float embA = embTexel.a;
          diffuseColor.rgb *= embTexel.rgb / max( embA, 1e-3 );
          diffuseColor.a *= embA;
        #endif`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replace(
          'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
          'vec4 embN = texture2D( normalMap, vNormalMapUv ); vec3 mapN = ( embN.xyz / max( embN.a, 1e-3 ) ) * 2.0 - 1.0;',
        ),
      );
  };
  return m;
}
