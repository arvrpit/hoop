// Shared stray-fibre ("fuzz") pattern for threads and knots.
// Stray fibres leaning out of the thread edge. u = mm along, o = mm outside the core edge.
float hairLayer(float u, float o, float lean, float curl, float laneW, float seed, float haloW, float px) {
  float x = u - o * lean - o * o * curl;
  float lane = floor(x / laneW);
  float hsh = hash2i(ivec2(int(lane), int(seed)));
  float present = step(0.42, hsh);
  float len = mix(0.35, 1.0, fract(hsh * 7.13)) * haloW;
  float centre = 0.5 + (fract(hsh * 13.7) - 0.5) * 0.5;
  float dist = abs(x / laneW - lane - centre) * laneW;
  float thick = 0.012;
  float w = max(thick, px) * 0.7;
  float line = (1.0 - smoothstep(0.0, w, dist)) * min(1.0, thick / px);
  float fade = 1.0 - smoothstep(len * 0.45, len, o);
  return present * line * fade;
}
