// French knot impostor: one instanced quad (-1..1) per knot.
#include "common/noise.glsl"
#include "common/oklab.glsl"

attribute vec4 iKnot;     // pos.xy (mm), thread index, seed
attribute vec4 iKnotMeta; // order, scale (pop animation; 1 = settled; negative = unpicking), 0, 0

uniform sampler2D uThreadTex;
uniform float uMmPerPx;
uniform float uKnotSize;  // knot diameter = thread width × this
uniform float uJitterWidth;
uniform float uJitterLightness;

varying vec2 vLocal;
varying vec2 vWorld;
flat varying vec3 vColor;
flat varying float vR;
flat varying float vW;
flat varying vec4 vM1;
flat varying vec4 vM2;
flat varying vec4 vM3;   // strand split, strands, flatten, -
flat varying vec3 vSeed; // twist phase, rotation, fibre offset
flat varying float vFade;

void main() {
  int ti = int(iKnot.z + 0.5);
  vec4 r0 = texelFetch(uThreadTex, ivec2(ti, 0), 0);
  vec4 r1 = texelFetch(uThreadTex, ivec2(ti, 1), 0);
  vec4 r2 = texelFetch(uThreadTex, ivec2(ti, 2), 0);
  vec4 r3 = texelFetch(uThreadTex, ivec2(ti, 3), 0);
  uint h = pcg(floatBitsToUint(iKnot.w) ^ 0x51ed270bu);
  h = pcg(h); float jw = float(h) * (2.0 / 4294967295.0) - 1.0;
  h = pcg(h); float jl = float(h) * (2.0 / 4294967295.0) - 1.0;
  h = pcg(h); float s1 = float(h) / 4294967295.0;
  h = pcg(h); float s2 = float(h) / 4294967295.0;
  h = pcg(h); float s3 = float(h) / 4294967295.0;

  float w = r0.w * (1.0 + jw * uJitterWidth);
  float pop = iKnotMeta.y;
  float R = 0.5 * w * uKnotSize * abs(pop);
  vFade = pop < 0.0 ? abs(pop) : 1.0;
  float halo = r2.z * w * 1.1;
  float ext = R + 0.25 * w + halo + 1.5 * uMmPerPx; // lower wrap pokes out a little
  vec2 local = position.xy * ext;
  vec2 world = iKnot.xy + local;

  vec3 lab = linearToOklab(r0.rgb);
  lab.x = clamp(lab.x + jl * uJitterLightness, 0.0, 1.0);
  vColor = max(oklabToLinear(lab), 0.0);
  vLocal = local;
  vWorld = world;
  vR = R;
  vW = w;
  vM1 = r1;
  vM2 = r2;
  vM3 = vec4(r3.x, r3.y, r3.z, 0.0);
  vSeed = vec3(s1, s2 * 6.2831853, s3);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
}
