attribute vec4 iDimple; // pos.xy, opacity, radius
uniform float uMmPerPx;
varying vec2 vLocal;
flat varying float vOpacity;
flat varying float vRadius;
void main() {
  float m = iDimple.w * 1.6 + 2.0 * uMmPerPx;
  vec2 local = position.xy * m;
  vLocal = local;
  vOpacity = iDimple.z;
  vRadius = iDimple.w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iDimple.xy + local, 0.0, 1.0);
}
