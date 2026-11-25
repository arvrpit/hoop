// Shared lighting for every surface in the hoop view (fabric, threads, knots, hoop ring), so they
// always match. World space: x right, y up, z out of the fabric towards the viewer; units are mm.
// The camera is orthographic and straight down, but highlights use a slightly tilted eye direction
// (uViewDir: as if you sat at the table looking down at the hoop), so sheen depends on stitch
// direction the way it does in real life instead of every thread glinting on top.

uniform vec3 uAmbientColor;   // linear RGB × intensity
uniform vec3 uKeyDir;         // unit vector towards the key ("window") light
uniform vec3 uKeyColor;       // linear RGB × intensity
uniform vec3 uLampPos;        // focus lamp: xy in hoop mm, z = height above the fabric
uniform vec3 uLampColor;      // linear RGB × intensity
uniform float uLampRadius;    // mm, width of the lamp's pool of light
uniform float uEdgeDim;       // 0–1, how much the surroundings dim outside the lamp pool
uniform float uHoopInnerR;    // mm
uniform float uRingHeight;    // mm the outer ring stands above the fabric
uniform vec3 uViewDir;        // eye direction used for highlights
uniform float uThreadExposure; // calibrates thread diffuse so stitched colour matches its swatch


// Soft pool of light from the focus lamp.
float lampSpot(vec2 p) {
  float x = length(p - uLampPos.xy) / max(uLampRadius, 1.0);
  return exp(-0.9 * x * x);
}

// The wooden ring blocks the low key light near the rim on the light's side.
float keyVisibility(vec2 p) {
  if (dot(p, p) >= uHoopInnerR * uHoopInnerR) return 1.0; // on or outside the ring itself
  vec2 d = normalize(uKeyDir.xy + 1e-6);
  float tanEl = uKeyDir.z / max(length(uKeyDir.xy), 1e-4);
  float b = dot(p, d);
  float c = dot(p, p) - uHoopInnerR * uHoopInnerR;
  float t = -b + sqrt(max(b * b - c, 0.0)); // distance to the rim towards the light
  float h = t * tanEl;                       // height of the light ray when it reaches the rim
  float soft = 0.4 + 0.3 * h;
  return smoothstep(uRingHeight - soft, uRingHeight + soft, h);
}

// Ambient occlusion close to the ring.
float ringAO(vec2 p) {
  float gap = uHoopInnerR - length(p);
  if (gap <= 0.0) return 1.0;
  return 1.0 - 0.32 * exp(-gap / 2.2);
}

// Everything about the lights at one point, computed once and reused by diffuse and sheen.
struct LightCtx {
  vec3 Ll;     // direction to the lamp
  float spot;  // lamp pool falloff
  float edge;  // dimming outside the lamp pool
  float ao;    // ring occlusion
  float vis;   // key light not blocked by the ring
};

LightCtx lightCtx(vec3 p) {
  LightCtx c;
  c.spot = lampSpot(p.xy);
  c.edge = 1.0 - uEdgeDim * (1.0 - c.spot);
  c.ao = ringAO(p.xy);
  c.vis = keyVisibility(p.xy);
  c.Ll = normalize(uLampPos - p);
  return c;
}

vec3 diffuseLightC(vec3 n, LightCtx c, float wrap) {
  float dk = max((dot(n, uKeyDir) + wrap) / (1.0 + wrap), 0.0);
  float dl = max((dot(n, c.Ll) + wrap) / (1.0 + wrap), 0.0);
  vec3 amb = uAmbientColor * (0.6 + 0.4 * n.z) * c.ao;
  return (amb + uKeyColor * dk * c.vis + uLampColor * dl * c.spot * c.ao) * c.edge;
}

// Diffuse light arriving at a surface with normal n at position p (z = height above fabric).
vec3 diffuseLight(vec3 n, vec3 p, float wrap) {
  return diffuseLightC(n, lightCtx(p), wrap);
}

// Anisotropic highlight for fibres with tangent T on a round surface with normal n, given the half
// vector H: Kajiya-Kay along the fibre, times a band across it where the surface faces H.
float fibreLobeH(vec3 T, vec3 n, vec3 H, float nl, float expAlong, float expAcross) {
  float th = dot(T, H);
  float along = pow(max(1.0 - th * th, 0.0), 0.5 * expAlong);
  vec3 Hp = H - th * T;
  float hl = length(Hp);
  Hp = hl > 1e-4 ? Hp / hl : n;
  float across = pow(max(dot(n, Hp), 0.0), expAcross);
  return along * across * smoothstep(0.0, 0.2, nl);
}

vec3 fibreSpecularC(vec3 T, vec3 n, LightCtx c, float expAlong, float expAcross) {
  vec3 Hk = normalize(uKeyDir + uViewDir);
  vec3 Hl = normalize(c.Ll + uViewDir);
  vec3 s = uKeyColor * fibreLobeH(T, n, Hk, dot(n, uKeyDir), expAlong, expAcross) * c.vis;
  s += uLampColor * fibreLobeH(T, n, Hl, dot(n, c.Ll), expAlong, expAcross) * c.spot;
  return s * c.edge;
}

vec3 fibreSpecular(vec3 T, vec3 n, vec3 p, float expAlong, float expAcross) {
  return fibreSpecularC(T, n, lightCtx(p), expAlong, expAcross);
}

// Gentle highlight shoulder instead of hard clipping (tone mapping stays otherwise neutral).
vec3 shoulder(vec3 c) {
  vec3 e = max(c - 0.82, 0.0);
  return min(c, 0.82) + e / (1.0 + e / 0.18);
}
