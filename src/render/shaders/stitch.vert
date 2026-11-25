// One instanced unit quad per stitch: x ∈ [0, 1] along a→b, y ∈ [-1, 1] across.
#include "common/noise.glsl"
#include "common/oklab.glsl"
#include "common/stitchInstance.glsl"

uniform float uJitterLightness;
uniform float uZStep; // later stitches sit a hair closer to the camera (depth pre-pass)
uniform float uCoreOnly; // 1 for the depth pre-pass: quad hugs the thread body (no fuzz margin)

invariant gl_Position;

varying vec2 vLocal;   // (mm along from a, mm across)
varying vec2 vWorld;   // hoop mm
flat varying vec3 vColor;
flat varying vec2 vT;
flat varying float vLen;
flat varying float vHalfW;
flat varying vec4 vM1; // plies, twist/mm, twist slope, ply depth
flat varying vec4 vM2; // sheen, spec exponent, fuzz, fibre
flat varying vec4 vM3; // strand split, strands, flatten, -
flat varying vec2 vSeed; // twist phase, fibre offset
flat varying float vFade;

void main() {
  StitchInst s = unpackStitch();
  vec4 r0 = texelFetch(uThreadTex, ivec2(s.thread, 0), 0);
  vec4 r1 = texelFetch(uThreadTex, ivec2(s.thread, 1), 0);
  vec4 r2 = texelFetch(uThreadTex, ivec2(s.thread, 2), 0);
  vec4 r3 = texelFetch(uThreadTex, ivec2(s.thread, 3), 0);

  float jl = rand11(s.h);
  float seedPhase = rand11(s.h) * 0.5 + 0.5;
  float seedOff = rand11(s.h) * 0.5 + 0.5;

  float halo = r2.z * 2.0 * s.halfW * 1.1 * (1.0 - uCoreOnly);
  float aa = 1.5 * uMmPerPx;
  float side = s.halfW + halo + aa;
  float endExt = aa + halo * 0.6;
  float along = mix(-endExt, s.len + endExt, position.x);
  float across = position.y * side;
  vec2 world = s.a + s.T * along + s.N * across;

  vec3 lab = linearToOklab(r0.rgb);
  lab.x = clamp(lab.x + jl * uJitterLightness, 0.0, 1.0);
  vColor = max(oklabToLinear(lab), 0.0);

  vLocal = vec2(along, across);
  vWorld = world;
  vT = s.T;
  vLen = s.len;
  vHalfW = s.halfW;
  vM1 = r1;
  vM2 = r2;
  vM3 = vec4(r3.x, r3.y, r3.z, 0.0);
  vSeed = vec2(seedPhase, seedOff);
  vFade = s.fade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, float(gl_InstanceID) * uZStep, 1.0);
}
