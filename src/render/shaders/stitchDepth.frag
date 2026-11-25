// Depth pre-pass: marks pixels fully covered by a thread body, so the expensive colour pass only
// shades the top-most thread at each pixel (rims and fuzz still blend over what lies beneath).
#include "common/stitchShape.glsl"

uniform float uMmPerPx;
uniform float uEndTaper;

varying vec2 vLocal;
flat varying float vLen;
flat varying float vHalfW;
flat varying float vFade;

void main() {
  StitchShape sh = stitchShape(vLocal.x, vLocal.y, vLen, vHalfW, uEndTaper, uMmPerPx);
  if (sh.core < 0.999 || vFade < 0.999) discard; // a stitch being unpicked hides nothing
  gl_FragColor = vec4(0.0);
}
