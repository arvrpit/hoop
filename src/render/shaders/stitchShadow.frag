// Writes r = soft shadow cast away from the key light, g = thin contact shadow right under the thread.
// Blending is MAX, so overlapping shadows never stack up darker than one.
uniform vec2 uShadowOffset;
uniform float uShadowBlur;
uniform float uShadowOpacity;
uniform float uContactOpacity;
uniform float uMmPerPx;

varying vec2 vLocal;
flat varying float vLen;
flat varying float vHalfW;
flat varying vec2 vT;
flat varying float vFade;

float segDist(vec2 p, float s0, float s1) {
  float t = clamp(p.x, s0, s1);
  return length(vec2(p.x - t, p.y));
}

void main() {
  vec2 off = vec2(dot(uShadowOffset, vT), dot(uShadowOffset, vec2(-vT.y, vT.x)));
  float s0 = min(vHalfW * 0.8, 0.5 * vLen);
  float s1 = vLen - s0;
  float dCast = segDist(vLocal - off, s0, s1) - vHalfW * 0.85;
  float castSh = uShadowOpacity * (1.0 - smoothstep(-uShadowBlur, uShadowBlur, dCast));
  float dC = segDist(vLocal, s0, s1) - vHalfW;
  float contact = uContactOpacity * (1.0 - smoothstep(-0.04, 0.1 + uMmPerPx, dC));
  gl_FragColor = vec4(castSh * vFade, contact * vFade, 0.0, 1.0);
}
