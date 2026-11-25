// Procedural fabric: a height field built per pixel in mm space, lit with the shared lighting.
// Weave detail fades out as yarns shrink below a few pixels, so zooming never shimmers.
#include "common/noise.glsl"
#include "common/lighting.glsl"

uniform int uFabricKind;      // 0 plain weave (cotton, linen, canvas), 1 aida block weave, 2 felt, 3 jersey knit
uniform vec3 uFabricColor;    // linear RGB
uniform float uThreadsPerMm;
uniform float uYarnWidth;
uniform float uYarnHeight;
uniform float uCrimp;
uniform float uColorVar;
uniform float uSlub;
uniform float uHoleSpacing;
uniform float uHoleSize;
uniform float uFibreScale;
uniform float uFabricSheen;
uniform float uMmPerPx;       // size of one device pixel in mm
uniform sampler2D uShadowTex; // stitch shadows: r = cast shadow, g = contact shadow + hole dimples
uniform vec2 uResolution;
uniform float uShadowsOn;
uniform int uOutputMode;      // 0 lit, 1 albedo, 2 normal
uniform sampler2D uGuideTex;  // the design traced on the fabric (hoop space), straight alpha
uniform float uGuideOn;
uniform float uGuideOpacity;
uniform float uGuideSize;     // mm covered by the guide texture, centred on the hoop

varying vec2 vPos;

struct Surf {
  float h;       // height in yarn pitches (only used for occlusion)
  vec2 grad;     // dh/dx, dh/dy (dimensionless slope)
  float ao;      // occlusion from the weave
  float tone;    // albedo multiplier
  vec2 yarnDir;  // fibre direction for the faint sheen (0 = none)
};

// Thick/thin spots along a yarn (linen slubs).
float slubAt(vec2 q) {
  float n = vnoise(q);
  return smoothstep(0.62, 0.95, n) - 0.4 * smoothstep(0.62, 0.95, 1.0 - n);
}

// Fine twist + fibre texture on a single yarn. along/across in yarn pitches.
float yarnTexture(float along, float across, float seed, float dFine) {
  if (dFine <= 0.0) return 0.0;
  float stripe = sin(2.0 * PI * (along * 2.6 + across * 0.55 + seed));
  float fib = vnoise(vec2(across * 7.0 + seed * 31.0, along * 1.8));
  return (0.45 * stripe + (fib - 0.5)) * dFine;
}

// One yarn's height and slope at this point. `prof` is the across-profile coordinate (-1..1).
Surf yarnSurf(float prof, float crimpH, float crimpSlope, float acrossScale, float height, bool vertical) {
  Surf s;
  float pr = sqrt(max(1.0 - prof * prof, 0.0));
  s.h = crimpH + height * pr;
  float dprof = -prof / max(pr, 0.22) * acrossScale * height;
  s.grad = vertical ? vec2(dprof, crimpSlope) : vec2(crimpSlope, dprof);
  s.ao = mix(0.8, 1.0, pr);
  s.tone = 1.0;
  s.yarnDir = vertical ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
  return s;
}

// Plain weave: warp (vertical) over weft where (i + j) is even. Yarn boundaries line up with holes.
Surf plainWeave(vec2 p, float dYarn, float dGap, float dFine) {
  float T = uThreadsPerMm;
  vec2 uv = p * T;
  vec2 cell = floor(uv);
  vec2 f = uv - cell;
  ivec2 ci = ivec2(cell);

  float wv = vnoise1(uv.y * 0.09 + hash1i(ci.x) * 113.0) - 0.5;
  float fv = vnoise1(uv.x * 0.09 + hash1i(ci.y + 7919) * 113.0) - 0.5;
  float ws = 0.0;
  float fs = 0.0;
  if (uSlub > 0.01) { // uniform branch: only linen has slubs
    ws = slubAt(vec2(cell.x * 3.7 + 11.0, uv.y * 0.045));
    fs = slubAt(vec2(cell.y * 4.3 + 37.0, uv.x * 0.045));
  }
  float ww = clamp(uYarnWidth * (1.0 + 0.12 * wv + uSlub * ws), 0.35, 1.0);
  float wf = clamp(uYarnWidth * (1.0 + 0.12 * fv + uSlub * fs), 0.35, 1.0);
  float hw = uYarnHeight * (1.0 + uSlub * ws * 0.8);
  float hf = uYarnHeight * (1.0 + uSlub * fs * 0.8);

  float dx = (f.x - 0.5) / (0.5 * ww);
  float dy = (f.y - 0.5) / (0.5 * wf);
  float aw = PI * (uv.y - 0.5 + cell.x);
  float af = PI * (uv.x - 0.5 + cell.y);
  Surf W = yarnSurf(dx, uCrimp * cos(aw), -uCrimp * PI * sin(aw), 1.0 / (0.5 * ww), hw, true);
  Surf F = yarnSurf(dy, -uCrimp * cos(af), uCrimp * PI * sin(af), 1.0 / (0.5 * wf), hf, false);
  bool inW = abs(dx) < 1.0;
  bool inF = abs(dy) < 1.0;

  float floorH = -uCrimp - 0.25 * uYarnHeight;
  Surf s;
  if (inW && (!inF || W.h >= F.h)) {
    s = W;
    float yarnTone = 1.0 + uColorVar * (2.0 * hash2i(ivec2(ci.x, 7)) - 1.0) + uColorVar * 0.6 * ws;
    s.tone = yarnTone * (1.0 + 0.1 * yarnTexture(uv.y, dx, float(ci.x & 1023) * 0.13, dFine));
  } else if (inF) {
    s = F;
    float yarnTone = 1.0 + uColorVar * (2.0 * hash2i(ivec2(ci.y, 13)) - 1.0) + uColorVar * 0.6 * fs;
    s.tone = yarnTone * (1.0 + 0.1 * yarnTexture(uv.x, dy, float(ci.y & 1023) * 0.17, dFine));
  } else {
    s.h = floorH;
    s.grad = vec2(0.0);
    s.ao = 0.5;
    s.tone = 0.85;
    s.yarnDir = vec2(0.0);
  }
  // Yarns that dip under a crossing sit in shadow.
  s.ao *= mix(0.72, 1.0, smoothstep(floorH, uCrimp + uYarnHeight, s.h));

  // Level of detail: fade relief first, then gaps.
  float meanAO = 0.86;
  bool isGap = !(inW || inF);
  float d = isGap ? dGap : dYarn;
  s.ao = mix(meanAO, s.ao, d);
  s.tone = mix(1.0, s.tone, max(d, 0.4));
  s.grad *= dYarn;
  return s;
}

// Aida: bundles of 4 threads woven as blocks, with open holes at the block corners (the stitch holes).
Surf aidaWeave(vec2 p, float dYarn, float dGap, float dFine) {
  float sp = uHoleSpacing;
  vec2 bc = p / sp;
  vec2 bi = floor(bc);
  vec2 f = bc - bi;
  float g = uHoleSize / sp;
  float bw = 1.0 - g;
  // Bundles are squeezed where they pass between two holes, so blocks look puffy and holes round.
  float bwW = bw * mix(0.8, 1.04, sin(PI * f.y));
  float bwF = bw * mix(0.8, 1.04, sin(PI * f.x));
  float qx = (f.x - 0.5) / (0.5 * bwW);
  float qy = (f.y - 0.5) / (0.5 * bwF);

  float hh = uYarnHeight;
  float aw = PI * (bc.y - 0.5 + bi.x);
  float af = PI * (bc.x - 0.5 + bi.y);
  float crW = uCrimp * cos(aw);
  float crF = -uCrimp * cos(af);

  // Four threads inside each bundle give the block its ribbed look.
  float sx = fract((clamp(qx, -1.0, 1.0) * 0.5 + 0.5) * 4.0) * 2.0 - 1.0;
  float sy = fract((clamp(qy, -1.0, 1.0) * 0.5 + 0.5) * 4.0) * 2.0 - 1.0;
  float bpx = sqrt(max(1.0 - qx * qx, 0.0));
  float bpy = sqrt(max(1.0 - qy * qy, 0.0));
  float tpx = sqrt(max(1.0 - sx * sx, 0.0));
  float tpy = sqrt(max(1.0 - sy * sy, 0.0));

  float hW = crW + hh * (0.6 * sqrt(bpx) + 0.4 * tpx * bpx);
  float hF = crF + hh * (0.6 * sqrt(bpy) + 0.4 * tpy * bpy);
  bool inW = abs(qx) < 1.0;
  bool inF = abs(qy) < 1.0;
  float floorH = -uCrimp - 0.5 * hh;

  Surf s;
  float scaleB = 1.0 / (0.5 * bw) / sp * (1.0 / uThreadsPerMm); // bundle-profile slope → mm-ish
  float scaleT = scaleB * 4.0;
  if (inW && (!inF || hW >= hF)) {
    float gB = -qx / max(bpx, 0.2) * 0.3 * hh * scaleB;
    float gT = -sx / max(tpx, 0.25) * 0.4 * hh * bpx * scaleT;
    s.h = hW;
    s.grad = vec2(gB + gT, -uCrimp * PI * sin(aw) / sp / uThreadsPerMm);
    s.ao = mix(0.6, 1.0, tpx) * mix(0.7, 1.0, bpx);
    s.tone = 1.0 + uColorVar * (2.0 * hash2i(ivec2(int(bi.x) * 4 + int((qx * 0.5 + 0.5) * 4.0), 3)) - 1.0);
    s.tone *= 1.0 + 0.05 * yarnTexture(bc.y * 4.0, sx, bi.x * 0.31, dFine);
    s.yarnDir = vec2(0.0, 1.0);
  } else if (inF) {
    float gB = -qy / max(bpy, 0.2) * 0.3 * hh * scaleB;
    float gT = -sy / max(tpy, 0.25) * 0.4 * hh * bpy * scaleT;
    s.h = hF;
    s.grad = vec2(uCrimp * PI * sin(af) / sp / uThreadsPerMm, gB + gT);
    s.ao = mix(0.6, 1.0, tpy) * mix(0.7, 1.0, bpy);
    s.tone = 1.0 + uColorVar * (2.0 * hash2i(ivec2(int(bi.y) * 4 + int((qy * 0.5 + 0.5) * 4.0), 5)) - 1.0);
    s.tone *= 1.0 + 0.05 * yarnTexture(bc.x * 4.0, sy, bi.y * 0.29, dFine);
    s.yarnDir = vec2(1.0, 0.0);
  } else {
    // An open hole: you look through the fabric into shadow.
    s.h = floorH;
    s.grad = vec2(0.0);
    s.ao = 0.3;
    s.tone = 0.75;
    s.yarnDir = vec2(0.0);
  }
  s.ao *= mix(0.6, 1.0, smoothstep(floorH, uCrimp + hh, s.h));

  float meanAO = 0.7;
  bool isGap = !(inW || inF);
  float d = isGap ? dGap : dYarn;
  s.ao = mix(meanAO, s.ao, d);
  s.tone = mix(1.0, s.tone, max(d, 0.4));
  s.grad *= dYarn;
  return s;
}

// Jersey knit (T-shirt fabric): columns of V-shaped loops. The opening between a loop's two legs,
// just below the tip of the loop above, is where the needle goes through; it sits on the hole lattice.
float jerseyLeg(float X, float Y, float side, float hw, out float gx, out float gy) {
  if (Y < -0.2 || Y > 1.2) return -1.0;
  float slope = 0.3;
  float lx = side * (0.1 + slope * Y);
  float cs = inversesqrt(1.0 + slope * slope);
  float pd = (X - lx) * cs;
  float t = pd / hw;
  gx = 0.0;
  gy = 0.0;
  if (abs(t) >= 1.0) return -1.0;
  float pr = sqrt(1.0 - t * t);
  float dp = -t / max(pr, 0.25) / hw * cs; // d(profile)/dX
  float along = 0.75 + 0.25 * sin(PI * clamp(Y, 0.0, 1.0));
  gx = dp * along;
  gy = -dp * side * slope * along;
  return pr * along;
}

Surf jerseyKnit(vec2 p, float dYarn, float dGap, float dFine) {
  float s = uHoleSpacing;
  vec2 q = vec2(p.x / s + 0.5, p.y / s + 0.7);
  vec2 cell = floor(q);
  float hw = uYarnWidth * 0.5;
  float best = -1.0;
  vec2 g = vec2(0.0);
  float wale = 0.0;
  float course = 0.0;
  float yy = 0.0;
  // Loops overlap their neighbours left/right and the rows above/below.
  for (int j = -1; j <= 1; j++) {
    float Y = q.y - cell.y - float(j);
    for (int k = -1; k <= 1; k++) {
      float X = q.x - cell.x - 0.5 - float(k);
      for (int sd = 0; sd < 2; sd++) {
        float side = sd == 0 ? -1.0 : 1.0;
        float gx, gy;
        float h = jerseyLeg(X, Y, side, hw, gx, gy) + 0.02 * float(j); // a row sits on the one below
        if (h > best) {
          best = h;
          g = vec2(gx, gy);
          wale = cell.x + float(k);
          course = cell.y + float(j);
          yy = Y;
        }
      }
    }
  }
  Surf su;
  if (best > 0.0) {
    su.h = best * uYarnHeight;
    su.grad = g * uYarnHeight * dYarn;
    su.ao = mix(0.62, 1.0, best);
    float tone = 1.0 + uColorVar * (2.0 * hash1i(int(wale) * 7 + 11) - 1.0) + uColorVar * 0.5 * (2.0 * hash1i(int(course) * 13 + 5) - 1.0);
    su.tone = tone * (1.0 + 0.08 * yarnTexture(yy * 1.5, best, wale * 0.37, dFine));
    su.yarnDir = normalize(vec2(0.3, 1.0));
  } else {
    su.h = -0.2;
    su.grad = vec2(0.0);
    su.ao = 0.42;
    su.tone = 0.85;
    su.yarnDir = vec2(0.0);
  }
  float d = best > 0.0 ? dYarn : dGap;
  su.ao = mix(0.8, su.ao, d);
  su.tone = mix(1.0, su.tone, max(d, 0.4));
  return su;
}

// Felt: matted fibres. Short curved fibre segments at random angles in a few layers, over soft clumps.
float feltFibreLayer(vec2 q, float seed, out float tone) {
  vec2 cell = floor(q);
  float best = 0.0;
  tone = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 c = ivec2(cell) + ivec2(i, j);
      ivec2 cs = c + ivec2(int(seed * 101.0), int(seed * 57.0));
      vec2 rnd = hash22i(cs);
      vec2 ctr = vec2(c) + rnd;
      float ang = hash2i(cs + ivec2(17, 3)) * PI;
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 nrm = vec2(-dir.y, dir.x);
      float hl = 0.7 + 0.3 * rnd.y;
      vec2 rel = q - ctr;
      float t = clamp(dot(rel, dir), -hl, hl);
      float bend = 0.5 * (rnd.x - 0.5) * (t * t - hl * hl);
      float dist = abs(dot(rel, nrm) - bend);
      float w = 0.08 + 0.06 * rnd.x;
      float prof = 1.0 - smoothstep(0.0, w, dist);
      prof *= 1.0 - smoothstep(hl * 0.6, hl, abs(dot(rel, dir)));
      if (prof > best) {
        best = prof;
        tone = rnd.x - 0.5;
      }
    }
  }
  return best;
}

float feltHeight(vec2 p, float dFine, out float tone) {
  float clumps = fbm(p * 0.7);
  float h = clumps * 0.25;
  tone = (clumps - 0.5) * 0.35;
  if (dFine > 0.0) {
    vec2 q = p / uFibreScale;
    float t1, t2, t3;
    float f1 = feltFibreLayer(q, 0.0, t1);
    float f2 = feltFibreLayer(q * 0.8 + 5.3, 1.0, t2);
    float f3 = feltFibreLayer(q * 1.25 + 9.1, 2.0, t3);
    float fib = max(f1, max(f2 * 0.85, f3 * 0.7));
    h += dFine * 0.025 * fib;
    tone += dFine * (0.12 * (t1 * f1 + t2 * f2) + 0.08 * fib);
    // Soft fuzz over everything, so the fibres read as matted rather than drawn.
    tone += 0.05 * (vnoise(q * 3.0) - 0.5);
  } else {
    // Too small to see individual fibres: keep a fine, even fuzz texture.
    tone += 0.06 * (vnoise(p * 9.0) - 0.5);
  }
  return h;
}

Surf feltSurface(vec2 p, float dFine) {
  Surf s;
  float t0;
  float h0 = feltHeight(p, dFine, t0);
  float e = max(0.012, uMmPerPx * 0.75);
  float t1, t2;
  float hx = feltHeight(p + vec2(e, 0.0), dFine, t1);
  float hy = feltHeight(p + vec2(0.0, e), dFine, t2);
  s.h = h0;
  s.grad = vec2(hx - h0, hy - h0) / e * uYarnHeight;
  s.ao = mix(0.82, 1.0, clamp(h0 * 2.5, 0.0, 1.0));
  s.tone = 1.0 + t0 * uColorVar * 3.0;
  s.yarnDir = vec2(0.0);
  return s;
}

void main() {
  float r = length(vPos);
  if (r > uHoopInnerR + 2.0) discard;
  vec2 p = vPos;
  float px = uMmPerPx;

  Surf s;
  if (uFabricKind == 2) {
    float dFine = smoothstep(0.8, 2.2, (uFibreScale * 0.18) / px);
    s = feltSurface(p, dFine);
  } else {
    float pitch = 1.0 / uThreadsPerMm;
    float dYarn = smoothstep(2.2, 5.5, pitch / px);
    float gapMm = uFabricKind == 1 ? uHoleSize : uFabricKind == 3 ? 0.3 * pitch : (1.0 - uYarnWidth) * pitch;
    float dGap = smoothstep(0.8, 2.2, gapMm / px) * dYarn;
    float dFine = smoothstep(4.0, 9.0, pitch / px);
    if (uFabricKind == 1) s = aidaWeave(p, dYarn, dGap, dFine);
    else if (uFabricKind == 3) s = jerseyKnit(p, dYarn, dGap, dFine);
    else s = plainWeave(p, dYarn, dGap, dFine);
  }

  vec3 n = normalize(vec3(-s.grad, 1.0));
  vec3 albedo = uFabricColor * s.tone;
  // Very gentle large-scale variation, like a washed natural fabric.
  albedo *= 1.0 + 0.035 * (0.65 * vnoise(p * 0.07 + 3.0) + 0.35 * vnoise(p * 0.19 + 11.0) - 0.5);
  // The traced design: like washable pen or a transfer, it colours the fabric and follows its texture.
  if (uGuideOn > 0.5) {
    vec2 guv = p / uGuideSize + 0.5;
    if (guv.x >= 0.0 && guv.x <= 1.0 && guv.y >= 0.0 && guv.y <= 1.0) {
      vec4 gd = texture(uGuideTex, guv);
      albedo = mix(albedo, gd.rgb, gd.a * uGuideOpacity);
    }
  }

  if (uOutputMode == 1) {
    gl_FragColor = vec4(albedo * s.ao, 1.0);
    return;
  }
  if (uOutputMode == 2) {
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
    return;
  }

  vec3 P = vec3(p, 0.0);
  vec3 col = albedo * diffuseLight(n, P, 0.0) * s.ao;
  if (uFabricSheen > 0.0 && dot(s.yarnDir, s.yarnDir) > 0.0) {
    col += uFabricSheen * fibreSpecular(vec3(s.yarnDir, 0.0), n, P, 12.0, 2.0) * s.ao;
  }
  if (uShadowsOn > 0.5) {
    vec4 sh = texture(uShadowTex, gl_FragCoord.xy / uResolution);
    col *= (1.0 - sh.r) * (1.0 - sh.g);
  }
  gl_FragColor = vec4(shoulder(col), 1.0);
  #include <colorspace_fragment>
}
