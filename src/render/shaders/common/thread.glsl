// The look of a length of thread, shared by stitches and French knots so both always match.
// Thread frame: x = along the thread, y = across it, z = up out of the fabric. Units: mm.
// Needs noise.glsl and lighting.glsl.

struct ThreadParams {
  float plies;      // visible plies per strand
  float twist;      // full twists per mm
  float slope;      // how far a groove leans across a strand (stripe periods across its width)
  float plyDepth;   // groove depth 0–1
  float sheen;
  float specExp;
  float fuzz;
  float fibre;
  float split;      // how separately the strands lie (0 = one round bundle)
  float strands;
  float flatten;    // 0 = round tube, 1 = flat ribbon
  float seedPhase;
  float seedOff;
};

struct ThreadSurf {
  vec3 nl;       // normal in the thread frame
  vec2 plyDir;   // fibre direction in the thread frame
  float crest;   // 1 on a ply crest, 0 in a groove (averaged when too small to see)
  float ao;
  float fib;     // fibre streak value, roughly -0.5..0.5
  float nzBase;
};

// u, acr: mm along / across from the centre line. hw: local half width. tilt: lean of the surface
// along the thread (used where the thread dives into a hole). px: one pixel in mm.
ThreadSurf threadSurface(float u, float acr, float hw, ThreadParams tp, float tilt, float px) {
  ThreadSurf o;
  float vc = clamp(acr / hw, -0.995, 0.995);

  // 1. Roundness, with the strands lying side by side and a slightly flattened cross-section.
  float S = max(tp.strands, 1.0);
  float splitOn = tp.split * step(1.5, S);
  float sc = (vc * 0.5 + 0.5) * S;
  float k = min(floor(sc), S - 1.0);
  float sl = clamp((sc - k) * 2.0 - 1.0, -0.995, 0.995);
  float shape = mix(vc, sl, splitOn * 0.75);
  float ny = shape * (1.0 - tp.flatten * (1.0 - pow(abs(shape), 3.0)));
  ny = clamp(ny, -0.985, 0.985);
  o.nzBase = sqrt(1.0 - ny * ny);
  float strandAO = 1.0 - splitOn * 0.55 * pow(abs(sl), 5.0);

  // 2. Twist: helical ply grooves (per strand once the strands read as separate).
  bool perStrand = splitOn > 0.3;
  float tv = perStrand ? sl : vc;
  float thw = perStrand ? hw / S : hw;
  float off = perStrand ? hash1i(int(k) + int(tp.seedOff * 997.0)) * 3.0 : 0.0;
  float asn = asin(tv) * (2.0 / PI);
  float phase = tp.plies * tp.twist * u + tp.slope * 0.5 * asn + tp.seedPhase * 4.0 + off;
  float fz = clamp(tp.fuzz * 2.0, 0.0, 1.0);
  float dTw = (1.0 - smoothstep(0.2, 0.45, fwidth(phase))) * (1.0 - 0.4 * fz);
  float pf = fract(phase);
  float crest = sin(PI * pf);
  float dcrest = PI * cos(PI * pf);
  vec2 gP = vec2(tp.plies * tp.twist, tp.slope / (PI * sqrt(max(1.0 - tv * tv, 0.05)) * thw));
  vec2 plyDir = normalize(vec2(gP.y, -gP.x));
  if (plyDir.x < 0.0) plyDir = -plyDir;
  vec2 gH = tp.plyDepth * 0.3 * thw * dcrest * gP * dTw;

  // 3. Fibre: fine streaks along each ply (crimpier and less aligned for fuzzy wool).
  vec2 lp = vec2(u, acr);
  vec2 fperp = vec2(-plyDir.y, plyDir.x);
  vec2 fq = vec2(dot(lp, plyDir), dot(lp, fperp));
  float aniso = clamp(1.0 - fz * 0.8, 0.2, 1.0);
  float dF1 = 1.0 - smoothstep(0.35, 0.8, px * 26.0);
  float dF2 = 1.0 - smoothstep(0.35, 0.8, px * 9.0);
  o.fib = 0.0;
  if (dF2 > 0.0) { // px is uniform across the screen, so this branch is coherent
    float f2 = vnoise(vec2(fq.x * mix(7.0, 0.9, aniso), fq.y * 9.0) + tp.seedOff * 91.0) - 0.5;
    o.fib += f2 * dF2 * 0.5 * aniso;
    if (dF1 > 0.0) {
      float f1 = vnoise(vec2(fq.x * mix(18.0, 2.2, aniso), fq.y * 26.0) + tp.seedOff * 173.0) - 0.5;
      o.fib += f1 * dF1 * 0.65;
    }
    o.fib *= tp.fibre;
  }

  vec3 nl = normalize(vec3(tilt, ny, o.nzBase));
  nl = normalize(nl - vec3(gH, 0.0) * nl.z);
  nl = normalize(nl + vec3(fperp * o.fib * 0.35, 0.0));
  o.nl = nl;
  o.plyDir = plyDir;
  o.crest = mix(0.64, crest, dTw);
  o.ao = (1.0 - 0.6 * tp.plyDepth * (1.0 - o.crest)) * mix(0.78, 1.0, o.nzBase) * strandAO;
  return o;
}

vec3 threadNormalWorld(ThreadSurf s, vec2 T) {
  vec3 T3 = vec3(T, 0.0);
  vec3 N3 = vec3(-T.y, T.x, 0.0);
  return normalize(s.nl.x * T3 + s.nl.y * N3 + vec3(0.0, 0.0, s.nl.z));
}

// 4. Diffuse + anisotropic sheen (Kajiya-Kay along the fibres × a band across the round thread).
vec3 shadeThread(ThreadSurf s, vec2 T, vec3 P, vec3 color, ThreadParams tp, float aoExtra) {
  vec3 T3 = vec3(T, 0.0);
  vec3 N3 = vec3(-T.y, T.x, 0.0);
  vec3 n = threadNormalWorld(s, T);
  vec3 Tf = normalize(s.plyDir.x * T3 + s.plyDir.y * N3);
  Tf = normalize(Tf - dot(Tf, n) * n);
  vec3 albedo = color * (1.0 + s.fib * 0.35);
  LightCtx lc = lightCtx(P);
  vec3 dif = diffuseLightC(n, lc, 0.3);
  float expAcross = 2.0 + tp.specExp * 0.1;
  vec3 sp1 = fibreSpecularC(Tf, n, lc, tp.specExp, expAcross);
  vec3 sp2 = fibreSpecularC(normalize(Tf + n * 0.22), n, lc, tp.specExp * 0.35, expAcross * 0.5);
  float grooveMask = 1.0 - 0.6 * min(tp.plyDepth * 1.4, 1.0);
  float specMask = mix(grooveMask, 1.0, s.crest) * clamp(1.0 + s.fib * 1.4, 0.0, 2.0) * aoExtra;
  vec3 specTint = mix(vec3(1.0), clamp(color * 2.0 + 0.25, 0.0, 1.0), 0.3);
  vec3 spec = sp1 * specTint + 0.5 * sp2 * clamp(color * 2.5, 0.0, 1.0);
  return albedo * dif * s.ao * aoExtra * uThreadExposure + tp.sheen * specMask * spec;
}
