// Loads GLSL sources and resolves our `#include "path"` lines (three's own `#include <chunk>` is left alone).
import noise from './common/noise.glsl?raw';
import oklab from './common/oklab.glsl?raw';
import lighting from './common/lighting.glsl?raw';
import fibres from './common/fibres.glsl?raw';
import thread from './common/thread.glsl?raw';
import stitchInstance from './common/stitchInstance.glsl?raw';
import stitchShape from './common/stitchShape.glsl?raw';
import stitchDepthFrag from './stitchDepth.frag?raw';
import fabricVert from './fabric.vert?raw';
import fabricFrag from './fabric.frag?raw';
import stitchVert from './stitch.vert?raw';
import stitchFrag from './stitch.frag?raw';
import knotVert from './knot.vert?raw';
import knotFrag from './knot.frag?raw';
import stitchShadowVert from './stitchShadow.vert?raw';
import stitchShadowFrag from './stitchShadow.frag?raw';
import knotShadowVert from './knotShadow.vert?raw';
import knotShadowFrag from './knotShadow.frag?raw';
import dimpleVert from './dimple.vert?raw';
import dimpleFrag from './dimple.frag?raw';
import planeVert from './plane.vert?raw';
import hoopRingFrag from './hoopRing.frag?raw';
import backgroundFrag from './background.frag?raw';

const chunks: Record<string, string> = {
  'common/noise.glsl': noise,
  'common/oklab.glsl': oklab,
  'common/lighting.glsl': lighting,
  'common/fibres.glsl': fibres,
  'common/thread.glsl': thread,
  'common/stitchInstance.glsl': stitchInstance,
  'common/stitchShape.glsl': stitchShape,
};

export function resolveIncludes(src: string, seen = new Set<string>()): string {
  return src.replace(/^[ \t]*#include\s+"([^"]+)"[ \t]*$/gm, (_m, path: string) => {
    if (seen.has(path)) return '';
    const chunk = chunks[path];
    if (chunk === undefined) throw new Error(`Unknown shader include "${path}"`);
    seen.add(path);
    return resolveIncludes(chunk, seen);
  });
}

const r = (s: string) => resolveIncludes(s);

export const shaders = {
  fabric: { vertex: r(fabricVert), fragment: r(fabricFrag) },
  stitch: { vertex: r(stitchVert), fragment: r(stitchFrag) },
  stitchDepth: { vertex: r(stitchVert), fragment: r(stitchDepthFrag) },
  knot: { vertex: r(knotVert), fragment: r(knotFrag) },
  stitchShadow: { vertex: r(stitchShadowVert), fragment: r(stitchShadowFrag) },
  knotShadow: { vertex: r(knotShadowVert), fragment: r(knotShadowFrag) },
  dimple: { vertex: r(dimpleVert), fragment: r(dimpleFrag) },
  hoopRing: { vertex: r(planeVert), fragment: r(hoopRingFrag) },
  background: { vertex: r(planeVert), fragment: r(backgroundFrag) },
};
