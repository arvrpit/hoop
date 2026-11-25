attribute vec4 iKnot;     // pos.xy, thread index, seed
attribute vec4 iKnotMeta; // order, scale
uniform sampler2D uThreadTex;
uniform float uKnotSize;
uniform vec2 uShadowOffset;
uniform float uShadowBlur;
uniform float uMmPerPx;
varying vec2 vLocal;
flat varying float vR;
void main() {
  int ti = int(iKnot.z + 0.5);
  float w = texelFetch(uThreadTex, ivec2(ti, 0), 0).w;
  float R = 0.5 * w * uKnotSize * abs(iKnotMeta.y);
  float m = R + length(uShadowOffset) * 1.6 + 2.0 * uShadowBlur + 2.0 * uMmPerPx;
  vec2 local = position.xy * m;
  vLocal = local;
  vR = R;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iKnot.xy + local, 0.0, 1.0);
}
