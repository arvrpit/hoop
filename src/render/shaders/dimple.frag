// A tiny darkened dent where thread enters a hole (contact shadow), written to the g channel.
varying vec2 vLocal;
flat varying float vOpacity;
flat varying float vRadius;
void main() {
  float r = length(vLocal) / max(vRadius, 1e-3);
  float a = vOpacity * exp(-2.2 * r * r);
  gl_FragColor = vec4(0.0, a, 0.0, 1.0);
}
