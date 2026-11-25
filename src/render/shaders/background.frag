// Warm tabletop: dim, softly vignetted, with the hoop's soft drop shadow, so the hoop is the lit object.
#include "common/noise.glsl"
#include "common/lighting.glsl"

uniform vec3 uTableColor;  // linear
uniform float uVignette;
uniform float uOuterR;

varying vec2 vPos;

void main() {
  float r = length(vPos);
  float vig = mix(1.0, 1.0 - uVignette, smoothstep(uOuterR * 0.9, uOuterR * 2.8, r));
  vec2 off = -normalize(uKeyDir.xy + 1e-6) * 5.0;
  float rs = length(vPos - off);
  float drop = 1.0 - 0.5 * (1.0 - smoothstep(uOuterR - 3.0, uOuterR + 10.0, rs));
  float spot = lampSpot(vPos);
  float grain = 0.97 + 0.06 * vnoise(vec2(vPos.x * 0.012, vPos.y * 0.09));
  vec3 col = uTableColor * vig * drop * (0.8 + 0.3 * spot) * grain;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  // Dither so the dark gradient never bands.
  gl_FragColor.rgb += (hash2i(ivec2(gl_FragCoord.xy)) - 0.5) / 255.0;
}
