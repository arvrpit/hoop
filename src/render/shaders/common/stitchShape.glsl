// Outline of a stitch in its own frame: a pinch + small round cap where it dives into each hole.
struct StitchShape {
  float d;        // mm from the nearer hole centre
  float taperLen;
  float hw;       // local half width
  float core;     // anti-aliased coverage of the thread body
};

StitchShape stitchShape(float u, float acr, float len, float hw0, float endTaper, float px) {
  StitchShape sh;
  sh.d = min(u, len - u);
  sh.taperLen = max(endTaper, hw0 * 1.1);
  float pinch = mix(0.5, 1.0, smoothstep(0.0, sh.taperLen, sh.d));
  float capR = max(min(hw0 * 0.5, 0.5 * len), 1e-3);
  float dc = clamp(sh.d / capR, 0.0, 1.0);
  float cap = sqrt(max(1.0 - (1.0 - dc) * (1.0 - dc), 0.0));
  sh.hw = max(hw0 * pinch * cap, 1e-4);
  float pv = px / sh.hw;
  sh.core = (1.0 - smoothstep(1.0 - pv, 1.0 + pv, abs(acr) / sh.hw)) * smoothstep(-px, px, sh.d);
  return sh;
}
