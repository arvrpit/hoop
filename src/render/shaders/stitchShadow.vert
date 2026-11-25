// Shadow pass for stitches: same instances, quad grown to cover the offset, blurred shadow.
#include "common/noise.glsl"
#include "common/stitchInstance.glsl"

uniform vec2 uShadowOffset;
uniform float uShadowBlur;

varying vec2 vLocal;
flat varying float vLen;
flat varying float vHalfW;
flat varying vec2 vT;
flat varying float vFade;

void main() {
  StitchInst s = unpackStitch();
  float m = s.halfW + length(uShadowOffset) + 2.0 * uShadowBlur + 0.15 + 2.0 * uMmPerPx;
  float along = mix(-m, s.len + m, position.x);
  float across = position.y * m;
  vec2 world = s.a + s.T * along + s.N * across;
  vLocal = vec2(along, across);
  vLen = s.len;
  vHalfW = s.halfW;
  vT = s.T;
  vFade = s.fade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
}
