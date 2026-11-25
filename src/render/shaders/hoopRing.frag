// Wooden embroidery hoop seen from above: two concentric bent-wood rings (the outer one sits a
// little higher), grain running along the strip, a soft lacquer sheen.
#include "common/noise.glsl"
#include "common/lighting.glsl"

uniform vec3 uWoodColor;   // linear
uniform float uInnerR;
uniform float uOuterR;
uniform float uMmPerPx;

varying vec2 vPos;

void main() {
  float r = length(vPos);
  float W = uOuterR - uInnerR;
  float t = (r - uInnerR) / W;
  float aa = uMmPerPx / W;
  float cover = smoothstep(-aa, aa, t) * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, t));
  if (cover <= 0.0) discard;

  // Inner ring 0..0.38, groove, outer ring 0.42..1.
  bool inner = t < 0.4;
  float c0 = inner ? 0.0 : 0.42;
  float c1 = inner ? 0.38 : 1.0;
  float height = inner ? uRingHeight * 0.7 : uRingHeight;
  float x = clamp((t - 0.5 * (c0 + c1)) / (0.5 * (c1 - c0)), -1.2, 1.2);
  float prof = sqrt(max(1.0 - min(x * x, 1.0), 0.0));
  float halfWmm = 0.5 * (c1 - c0) * W;
  // Flattened top, rounded shoulders.
  float rounding = smoothstep(0.55, 1.0, abs(x));
  float slope = height * (x / max(prof, 0.18)) / halfWmm * mix(0.25, 1.0, rounding);
  vec2 radial = vPos / max(r, 1e-3);
  vec3 n = normalize(vec3(radial * slope, 1.0));

  float ang = atan(vPos.y, vPos.x);
  float s = ang * r;
  float wob = fbm(vec2(s * 0.018, r * 0.3)) * 3.0;
  float g = r * 1.6 + wob;
  float lines = smoothstep(0.82, 1.0, abs(sin(PI * g)));
  float pores = vnoise(vec2(s * 1.4, r * 11.0));
  float figure = fbm(vec2(s * 0.04, r * 0.8) + 7.0);
  vec3 wood = uWoodColor * (1.0 - 0.16 * lines) * (0.93 + 0.12 * pores) * (0.9 + 0.2 * figure);

  float groove = smoothstep(0.36, 0.4, t) * (1.0 - smoothstep(0.4, 0.44, t));
  float ao = mix(0.55, 1.0, sqrt(prof)) * (1.0 - 0.6 * groove);

  vec3 P = vec3(vPos, height * prof);
  vec3 T = vec3(-radial.y, radial.x, 0.0);
  vec3 col = wood * diffuseLight(n, P, 0.2) * ao;
  col += 0.12 * fibreSpecular(T, n, P, 8.0, 10.0) * ao;
  gl_FragColor = vec4(shoulder(col), cover);
  #include <colorspace_fragment>
}
