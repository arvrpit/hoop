uniform vec2 uShadowOffset;
uniform float uShadowBlur;
uniform float uShadowOpacity;
uniform float uContactOpacity;
uniform float uMmPerPx;
varying vec2 vLocal;
flat varying float vR;
void main() {
  // Knots stand taller than flat stitches, so their shadow reaches further.
  float dCast = length(vLocal - uShadowOffset * 1.6) - vR * 0.85;
  float castSh = min(1.0, uShadowOpacity * 1.3) * (1.0 - smoothstep(-uShadowBlur * 1.4, uShadowBlur * 1.4, dCast));
  float dC = length(vLocal) - vR;
  float contact = min(1.0, uContactOpacity * 1.6) * (1.0 - smoothstep(-0.05, 0.14 + uMmPerPx, dC));
  gl_FragColor = vec4(castSh, contact, 0.0, 1.0);
}
