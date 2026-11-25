// Thread shader (spec 6.3). Layers: roundness → twist → fibre + fuzz halo → anisotropic sheen →
// tapered ends → per-stitch imperfection (vertex shader) → anti-aliasing (fwidth fades).
// The same shader serves lit / albedo / normal output (albedo + normal are for mockup baking).
#include "common/noise.glsl"
#include "common/lighting.glsl"
#include "common/fibres.glsl"
#include "common/thread.glsl"
#include "common/stitchShape.glsl"

uniform float uMmPerPx;
uniform float uEndTaper;
uniform float uEndDarken;
uniform float uOpacity;
uniform int uOutputMode; // 0 lit, 1 albedo, 2 normal

varying vec2 vLocal;
varying vec2 vWorld;
flat varying vec3 vColor;
flat varying vec2 vT;
flat varying float vLen;
flat varying float vHalfW;
flat varying vec4 vM1; // plies, twist/mm, slope, ply depth
flat varying vec4 vM2; // sheen, spec exponent, fuzz, fibre
flat varying vec4 vM3; // strand split, strands, flatten, -
flat varying vec2 vSeed;
flat varying float vFade;

void main() {
  float px = uMmPerPx;
  float u = vLocal.x;
  float acr = vLocal.y;
  float len = vLen;
  float hw0 = vHalfW;
  ThreadParams tp = ThreadParams(vM1.x, vM1.y, vM1.z, vM1.w, vM2.x, vM2.y, vM2.z, vM2.w,
                                 vM3.x, vM3.y, vM3.z, vSeed.x, vSeed.y);

  // 5. Ends: the thread pinches, darkens and dives into each hole.
  StitchShape sh = stitchShape(u, acr, len, hw0, uEndTaper, px);
  float d = sh.d;
  float taperLen = sh.taperLen;
  float hw = sh.hw;
  float core = sh.core;

  // 3b. Fuzz halo: stray fibres plus a faint haze just outside the core.
  float haloW = tp.fuzz * 2.0 * hw0 * 1.1;
  float halo = 0.0;
  if (haloW > 0.006) {
    float o = length(vec2(max(abs(acr) - hw, 0.0), max(-d, 0.0)));
    if (o < haloW) {
      float s0 = floor(tp.seedOff * 9973.0) + (acr > 0.0 ? 7919.0 : 15887.0);
      float h1 = hairLayer(u, o, 0.9, 1.5, 0.04, s0, haloW, px);
      float h2 = hairLayer(u, o, -0.7, -1.0, 0.055, s0 + 31.0, haloW, px);
      float h3 = hairLayer(u, o, 0.2, 2.5, 0.07, s0 + 77.0, haloW * 0.8, px);
      float q = o / haloW;
      halo = clamp(0.9 * max(max(h1, h2), h3) + 0.14 * (1.0 - q) * (1.0 - q), 0.0, 1.0);
      halo *= clamp(tp.fuzz * 2.2, 0.0, 1.0);
    }
  }
  float alpha = core + halo * (1.0 - core);
  if (alpha < 0.003) discard;
  vec3 P = vec3(vWorld, 0.5);
  if (core <= 0.0) {
    // Pure fuzz: skip the full thread model.
    if (uOutputMode == 1) { gl_FragColor = vec4(vColor * 1.1, alpha * uOpacity * vFade); return; }
    if (uOutputMode == 2) { gl_FragColor = vec4(0.5, 0.5, 1.0, alpha * uOpacity * vFade); return; }
    vec2 N2h = vec2(-vT.y, vT.x);
    vec3 hc = vColor * 1.1 * uThreadExposure * diffuseLight(normalize(vec3(sign(acr) * N2h * 0.5, 1.0)), P, 0.5);
    gl_FragColor = vec4(shoulder(hc), alpha * uOpacity * vFade);
    #include <colorspace_fragment>
    return;
  }

  float dive = 1.0 - smoothstep(0.0, taperLen * 1.2, d);
  float tilt = (u < 0.5 * len ? -1.0 : 1.0) * dive * 0.9;
  ThreadSurf s = threadSurface(u, acr, hw, tp, tilt, px);
  float aoEnd = mix(1.0 - uEndDarken, 1.0, smoothstep(0.0, taperLen * 1.3, d));

  if (uOutputMode == 1) {
    vec3 alb = vColor * (1.0 + s.fib * 0.35) * s.ao * aoEnd;
    gl_FragColor = vec4(mix(vColor * 1.1, alb, core / alpha), alpha * uOpacity * vFade);
    return;
  }
  if (uOutputMode == 2) {
    vec3 n = threadNormalWorld(s, vT);
    gl_FragColor = vec4(mix(vec3(0.0, 0.0, 1.0), n, core / alpha) * 0.5 + 0.5, alpha * uOpacity * vFade);
    return;
  }

  vec3 coreCol = shadeThread(s, vT, P, vColor, tp, aoEnd);
  vec3 col = coreCol;
  if (core < 0.999) {
    vec2 N2 = vec2(-vT.y, vT.x);
    vec3 haloCol = vColor * 1.1 * uThreadExposure * diffuseLight(normalize(vec3(sign(acr) * N2 * 0.5, 1.0)), P, 0.5);
    col = mix(haloCol, coreCol, core / alpha);
  }
  gl_FragColor = vec4(shoulder(col), alpha * uOpacity * vFade);
  #include <colorspace_fragment>
}
