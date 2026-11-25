// French knot seen from above: the thread wrapped round the needle forms a small ring (the top wrap)
// with a second wrap peeking out beneath it, and a dark centre where the needle went back down.
// Each wrap is shaded with exactly the same thread model as stitches (twist, fibre, sheen).
#include "common/noise.glsl"
#include "common/lighting.glsl"
#include "common/fibres.glsl"
#include "common/thread.glsl"

uniform float uMmPerPx;
uniform float uOpacity;
uniform int uOutputMode;

varying vec2 vLocal;
varying vec2 vWorld;
flat varying vec3 vColor;
flat varying float vR;
flat varying float vW;
flat varying vec4 vM1;
flat varying vec4 vM2;
flat varying vec4 vM3;
flat varying vec3 vSeed;
flat varying float vFade;

void main() {
  float px = uMmPerPx;
  vec2 q = vLocal;
  float R = max(vR, 1e-3);
  // Wraps squash together, so each one is a little wider than the thread and the centre closes up.
  float hw = min(0.5 * vW * 1.25, R * 0.46);
  ThreadParams tp = ThreadParams(vM1.x, vM1.y, vM1.z, vM1.w, vM2.x, vM2.y, vM2.z, vM2.w,
                                 vM3.x * 0.6, vM3.y, vM3.z, vSeed.x, vSeed.z);

  float rot = vSeed.y;
  vec2 e1 = vec2(cos(rot), sin(rot)) * hw * 0.12;
  vec2 e2 = vec2(cos(rot + 2.4), sin(rot + 2.4)) * hw * 0.35;
  float rr1 = R - hw * 1.12;
  float rr2 = R - hw * 1.0;
  vec2 q1 = q - e1;
  vec2 q2 = q - e2;
  float rho1 = max(length(q1), 1e-4);
  float rho2 = max(length(q2), 1e-4);
  float a1 = rho1 - rr1;
  float a2 = rho2 - rr2;
  float h1 = sqrt(max(hw * hw - a1 * a1, 0.0));
  float h2 = sqrt(max(hw * hw - a2 * a2, 0.0)) - 0.45 * hw;
  bool in1 = abs(a1) < hw;
  bool in2 = abs(a2) < hw;
  float dOut = min(rho1 - rr1 - hw, rho2 - rr2 - hw);
  float core = 1.0 - smoothstep(-px, px, dOut);

  // Fuzz halo round the outside.
  float haloW = tp.fuzz * vW * 1.1;
  float halo = 0.0;
  float theta = atan(q.y, q.x);
  if (haloW > 0.006 && dOut > -px && dOut < haloW) {
    float o = max(dOut, 0.0);
    float s0 = floor(vSeed.z * 9973.0);
    float hA = hairLayer(theta * R, o, 0.8, 1.2, 0.04, s0, haloW, px);
    float hB = hairLayer(theta * R, o, -0.6, -1.0, 0.055, s0 + 31.0, haloW, px);
    float qh = o / haloW;
    halo = clamp(0.9 * max(hA, hB) + 0.14 * (1.0 - qh) * (1.0 - qh), 0.0, 1.0) * clamp(tp.fuzz * 2.2, 0.0, 1.0);
  }
  float alpha = core + halo * (1.0 - core);
  if (alpha < 0.003) discard;

  // The last pass of thread crosses the top wrap and dives into the centre.
  vec2 bd = vec2(cos(rot + 2.7), sin(rot + 2.7));
  float bAlong = dot(q, bd);
  float bAcr = dot(q, vec2(-bd.y, bd.x));
  float bl = R - hw * 0.25;
  float bt = clamp(bAlong, 0.0, bl);
  float bhw0 = hw * 0.9;
  float bPinch = mix(0.65, 1.0, smoothstep(0.0, hw * 1.2, bAlong));
  float bhw = bhw0 * bPinch;
  bool inBar = abs(bAcr) < bhw && bAlong > 0.0 && bAlong < bl;

  // Pick the visible surface: crossing strand, top wrap, lower wrap, or the shadowed centre.
  int which = 0;
  if (inBar) which = 3;
  else if (in1 && (!in2 || h1 >= h2)) which = 1;
  else if (in2) which = 2;
  vec2 qi = which == 2 ? q2 : q1;
  float rho = which == 2 ? rho2 : rho1;
  float rr = which == 2 ? rr2 : rr1;
  float acr = which == 2 ? a2 : a1;
  vec2 radial = qi / rho;
  vec2 T = vec2(radial.y, -radial.x); // so "across" points outwards
  float th = atan(qi.y, qi.x);
  // Whole number of twists round the ring, so the wrap closes without a seam.
  float circ = 2.0 * PI * max(rr, 1e-3);
  float P = max(tp.plies, 1.0);
  tp.twist = max(1.0, floor(P * tp.twist * circ + 0.5)) / (P * circ);
  ThreadSurf s;
  float aoExtra = which == 2 ? 0.72 : 1.0;
  if (which == 3) {
    T = bd;
    float dive = 1.0 - smoothstep(0.0, hw * 1.6, bAlong);
    s = threadSurface(bAlong, bAcr, max(bhw, 1e-4), tp, -dive * 0.9, px);
    aoExtra = mix(0.55, 1.0, smoothstep(0.0, hw * 1.5, bAlong));
  } else {
    s = threadSurface(-th * rr, acr, hw, tp, 0.0, px);
  }
  if (which == 0) {
    s.nl = vec3(0.0, 0.0, 1.0);
    s.ao = 0.85;
    s.crest = 0.2;
    aoExtra = 0.75;
  }

  if (uOutputMode == 1) {
    vec3 alb = vColor * (1.0 + s.fib * 0.35) * s.ao * aoExtra;
    gl_FragColor = vec4(mix(vColor * 1.1, alb, core / alpha), alpha * uOpacity * vFade);
    return;
  }
  if (uOutputMode == 2) {
    vec3 n = threadNormalWorld(s, T);
    gl_FragColor = vec4(mix(vec3(0.0, 0.0, 1.0), n, core / alpha) * 0.5 + 0.5, alpha * uOpacity * vFade);
    return;
  }

  float hgt = 0.5 + (which == 3 ? 2.0 * hw : which == 2 ? h2 : h1) + hw;
  vec3 P3 = vec3(vWorld, hgt);
  vec3 coreCol = shadeThread(s, T, P3, vColor, tp, aoExtra);
  vec2 rq = q / max(length(q), 1e-4);
  vec3 haloCol = vColor * 1.1 * uThreadExposure * diffuseLight(normalize(vec3(rq * 0.5, 1.0)), P3, 0.5);
  vec3 col = mix(haloCol, coreCol, core / alpha);
  gl_FragColor = vec4(shoulder(col), alpha * uOpacity * vFade);
  #include <colorspace_fragment>
}
