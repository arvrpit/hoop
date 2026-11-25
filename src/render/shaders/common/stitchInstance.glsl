// Shared by the visible stitch pass and the shadow pass: unpacks one stitch instance.
// Thread table texture rows: 0 = colour.rgb (linear), width mm
//                            1 = plies, twist/mm, twist slope, ply depth
//                            2 = sheen, spec exponent, fuzz, fibre
//                            3 = strand split, strands, flatten, roughness
attribute vec4 iAB;    // a.xy, b.xy in mm
attribute vec4 iMeta;  // thread index, seed, order, progress (0→1 pull-through; 1 = done; -1→0 unpicking)

uniform sampler2D uThreadTex;
uniform float uMmPerPx;
uniform float uJitterWidth;
uniform float uJitterEndpoint;
uniform float uWidthScale;

struct StitchInst {
  vec2 a;
  vec2 b;
  vec2 T;
  vec2 N;
  float len;
  float halfW;
  float progress;
  float fade;
  int thread;
  uint h; // per-stitch random stream
};

float rand11(inout uint h) {
  h = pcg(h);
  return float(h) * (2.0 / 4294967295.0) - 1.0;
}

StitchInst unpackStitch() {
  StitchInst s;
  s.thread = int(iMeta.x + 0.5);
  s.h = pcg(floatBitsToUint(iMeta.y) ^ 0x9e3779b9u);
  vec4 r0 = texelFetch(uThreadTex, ivec2(s.thread, 0), 0);
  vec2 ja = vec2(rand11(s.h), rand11(s.h));
  vec2 jb = vec2(rand11(s.h), rand11(s.h));
  float jw = rand11(s.h);
  s.a = iAB.xy + ja * uJitterEndpoint;
  vec2 b = iAB.zw + jb * uJitterEndpoint;
  float pw = iMeta.w;
  s.progress = clamp(abs(pw), 0.0, 1.0);
  s.fade = pw < 0.0 ? s.progress : 1.0; // unpicking: retract towards the start hole and fade
  s.b = mix(s.a, b, s.progress);
  vec2 d = s.b - s.a;
  s.len = length(d);
  s.T = s.len > 1e-5 ? d / s.len : vec2(1.0, 0.0);
  s.N = vec2(-s.T.y, s.T.x);
  float settle = pw >= 0.0 ? mix(1.15, 1.0, s.progress) : 1.0;
  s.halfW = 0.5 * r0.w * (1.0 + jw * uJitterWidth) * settle * uWidthScale;
  return s;
}
