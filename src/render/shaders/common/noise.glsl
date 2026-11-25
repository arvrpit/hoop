// Integer (PCG) hashing + value noise. Integer hashes are stable on every GPU, unlike sin() hashes.
#ifndef PI
#define PI 3.14159265359
#endif

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hashU(uint v) { return float(pcg(v)) * (1.0 / 4294967295.0); }
float hash1i(int i) { return hashU(uint(i)); }
float hash2i(ivec2 i) { return hashU(pcg(uint(i.x)) + uint(i.y)); }
vec2 hash22i(ivec2 i) {
  uint h = pcg(pcg(uint(i.x)) + uint(i.y));
  return vec2(float(h & 0xffffu), float(h >> 16u)) * (1.0 / 65535.0);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = hash2i(ii);
  float b = hash2i(ii + ivec2(1, 0));
  float c = hash2i(ii + ivec2(0, 1));
  float d = hash2i(ii + ivec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float vnoise1(float x) {
  float i = floor(x);
  float f = x - i;
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1i(int(i)), hash1i(int(i) + 1), u);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = rot * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s / 0.9375;
}
