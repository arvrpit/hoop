// Procedural embroidery baker: builds albedo(+alpha), normal and anisotropy maps
// for a small stitched tree, entirely in mm space. Origin = texture centre, y up.

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

// thread materials: plies = visible twisted plies, twist = turns per mm
export const MATERIALS = {
  floss: { plies: 3, twist: 0.55, slope: 0.9, fuzz: 0.18, aniso: 0.55 },
  perle: { plies: 2, twist: 1.0, slope: 1.1, fuzz: 0.05, aniso: 0.75 },
  silk:  { plies: 1, twist: 0.15, slope: 0.3, fuzz: 0.02, aniso: 0.95 },
  wool:  { plies: 2, twist: 0.45, slope: 0.8, fuzz: 0.5, aniso: 0.15 },
};

export function bakeEmbroidery({ sizeMm = 100, px = 2048, design }) {
  const ppm = px / sizeMm, half = sizeMm / 2, N = px * px;
  const A = new Float32Array(N * 3);          // albedo (sRGB 0..1)
  const AL = new Float32Array(N);             // alpha
  const NM = new Float32Array(N * 3);         // normal (tangent space)
  const AN = new Float32Array(N * 3);         // anisotropy dir xy + strength
  for (let i = 0; i < N; i++) NM[i * 3 + 2] = 1;
  const SH = new Float32Array(N);             // contact shadow

  const toPx = (mm) => (mm + half) * ppm;
  const loopBox = (x0, y0, x1, y1, fn) => {
    const ix0 = clamp(Math.floor(toPx(x0)), 0, px - 1), ix1 = clamp(Math.ceil(toPx(x1)), 0, px - 1);
    const iy0 = clamp(Math.floor(toPx(y0)), 0, px - 1), iy1 = clamp(Math.ceil(toPx(y1)), 0, px - 1);
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++)
      fn((ix + 0.5) / ppm - half, (iy + 0.5) / ppm - half, iy * px + ix);
  };
  const over = (i, a, rgb, n, an) => {
    if (a <= 0) return;
    const ia = 1 - a;
    for (let c = 0; c < 3; c++) {
      A[i * 3 + c] = rgb[c] * a + A[i * 3 + c] * ia;
      NM[i * 3 + c] = n[c] * a + NM[i * 3 + c] * ia;
      AN[i * 3 + c] = an[c] * a + AN[i * 3 + c] * ia;
    }
    AL[i] = a + AL[i] * ia;
  };

  const shadowOff = [0.22, -0.28], shadowSoft = 0.45;

  function shadowSegment(a, b, w) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / len, uy = dy / len, hw = w / 2, m = hw + shadowSoft + 0.5;
    loopBox(Math.min(a[0], b[0]) - m + shadowOff[0], Math.min(a[1], b[1]) - m + shadowOff[1],
            Math.max(a[0], b[0]) + m + shadowOff[0], Math.max(a[1], b[1]) + m + shadowOff[1], (x, y, i) => {
      const rx = x - shadowOff[0] - a[0], ry = y - shadowOff[1] - a[1];
      const t = clamp(rx * ux + ry * uy, 0, len);
      const d = Math.hypot(rx - ux * t, ry - uy * t);
      SH[i] = Math.max(SH[i], (1 - smooth(hw * 0.5, hw + shadowSoft, d)) * 0.42);
    });
  }
  function shadowDisk(c, r) {
    const m = r + shadowSoft + 0.5;
    loopBox(c[0] - m + shadowOff[0], c[1] - m + shadowOff[1], c[0] + m + shadowOff[0], c[1] + m + shadowOff[1], (x, y, i) => {
      const d = Math.hypot(x - shadowOff[0] - c[0], y - shadowOff[1] - c[1]);
      SH[i] = Math.max(SH[i], (1 - smooth(r * 0.6, r + shadowSoft, d)) * 0.5);
    });
  }

  function stitch(a, b, w, col, mat, seed) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 0.05) return;
    const ux = dx / len, uy = dy / len, px_ = -uy, py_ = ux;
    const rnd = mulberry32(seed);
    const hw = (w / 2) * (1 + (rnd() - 0.5) * 0.16);
    const lj = 1 + (rnd() - 0.5) * 0.08;
    const fuzzW = hw * mat.fuzz * 0.9;
    const m = hw + fuzzW + 0.3;
    const phase0 = rnd() * 10;
    loopBox(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, (x, y, i) => {
      const rx = x - a[0], ry = y - a[1];
      const along = rx * ux + ry * uy, across = rx * px_ + ry * py_;
      const ed = Math.min(along, len - along);
      if (ed < -0.3 * w) return;
      const taper = smooth(-0.25 * w, 0.4 * w, ed);
      const hwe = hw * (0.3 + 0.7 * taper);
      const ad = Math.abs(across);
      const cov = clamp((hwe - ad) * ppm + 0.5, 0, 1);
      // fibre fuzz just outside the core
      if (cov < 1 && fuzzW > 0 && ad < hwe + fuzzW) {
        const fn = vnoise(along * 9 + seed * 0.37, across * 55);
        const fa = clamp((1 - (ad - hwe) / fuzzW) * (fn - 0.45) * 2.2, 0, 1) * 0.55 * taper;
        if (fa > 0) {
          const c = col.map((v) => Math.min(1, v * 1.08 * lj));
          over(i, fa * (1 - cov), c, [px_ * Math.sign(across) * 0.6, py_ * Math.sign(across) * 0.6, 0.8], [ux * 0.5 + 0.5, uy * 0.5 + 0.5, 0.1]);
        }
      }
      if (cov <= 0) return;
      const v = clamp(across / hwe, -0.985, 0.985), nz = Math.sqrt(1 - v * v);
      const ph = phase0 + along * mat.twist * mat.plies + v * mat.slope;
      const s = fract(ph * (mat.plies > 1 ? 1 : 1)), hply = Math.sin(Math.PI * s), dply = Math.cos(Math.PI * s);
      let nx = px_ * v * 0.95 + ux * dply * 0.38 * nz * (mat.plies > 1 ? 1 : 0.3);
      let ny = py_ * v * 0.95 + uy * dply * 0.38 * nz * (mat.plies > 1 ? 1 : 0.3);
      let nzz = nz;
      const nl = Math.hypot(nx, ny, nzz); nx /= nl; ny /= nl; nzz /= nl;
      const fib = vnoise(along * 16 + seed, across * 48);
      const endAO = 0.72 + 0.28 * smooth(0, 0.45 * w, ed);
      const groove = mat.plies > 1 ? 0.78 + 0.22 * hply : 0.95 + 0.05 * hply;
      const shade = (0.8 + 0.2 * nz) * groove * (0.93 + 0.12 * fib) * endAO * lj;
      over(i, cov, [col[0] * shade, col[1] * shade, col[2] * shade], [nx, ny, nzz], [ux * 0.5 + 0.5, uy * 0.5 + 0.5, mat.aniso]);
    });
  }

  function knot(c, r, col, seed) {
    const rnd = mulberry32(seed), rot = rnd() * TAU, m = r + 0.3;
    loopBox(c[0] - m, c[1] - m, c[0] + m, c[1] + m, (x, y, i) => {
      const dx = x - c[0], dy = y - c[1], d = Math.hypot(dx, dy) / r;
      const cov = clamp((1 - d) * r * ppm + 0.5, 0, 1);
      if (cov <= 0) return;
      const dd = Math.min(d, 0.985), nz = Math.sqrt(1 - dd * dd);
      const ang = Math.atan2(dy, dx);
      const ridge = Math.sin(ang * 5 + rot + d * 11);
      const tx = -Math.sin(ang), ty = Math.cos(ang), rx = Math.cos(ang), ry = Math.sin(ang);
      let nx = rx * dd * 0.9 + tx * ridge * 0.6 * nz, ny = ry * dd * 0.9 + ty * ridge * 0.6 * nz, nzz = nz;
      const nl = Math.hypot(nx, ny, nzz); nx /= nl; ny /= nl; nzz /= nl;
      const shade = (0.74 + 0.26 * nz) * (0.68 + 0.32 * (ridge * 0.5 + 0.5));
      over(i, cov, col.map((v) => v * shade), [nx, ny, nzz], [tx * 0.5 + 0.5, ty * 0.5 + 0.5, 0.5]);
    });
  }

  // 1) shadows for everything, 2) threads in creation order
  for (const s of design) {
    if (s.kind === 'stitch') shadowSegment(s.a, s.b, s.w);
    else shadowDisk(s.c, s.r);
  }
  for (let i = 0; i < N; i++) { AL[i] = SH[i]; }  // black, translucent
  let seed = 1;
  for (const s of design) {
    seed++;
    if (s.kind === 'stitch') stitch(s.a, s.b, s.w, s.col, MATERIALS[s.mat], seed * 7919);
    else knot(s.c, s.r, s.col, seed * 104729);
  }

  const albedo = new Uint8Array(N * 4), normal = new Uint8Array(N * 4), aniso = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const a = AL[i];
    // un-premultiply colour so the shadow stays black and threads keep colour
    for (let c = 0; c < 3; c++) albedo[i * 4 + c] = clamp(Math.round((a > 0 ? A[i * 3 + c] / a : 0) * 255), 0, 255);
    albedo[i * 4 + 3] = Math.round(clamp(a, 0, 1) * 255);
    for (let c = 0; c < 3; c++) normal[i * 4 + c] = Math.round((NM[i * 3 + c] * 0.5 + 0.5) * 255);
    normal[i * 4 + 3] = 255;
    // anisotropy map: RG = direction, B = strength (premultiplied by coverage)
    const cov = Math.max(0, a - SH[i]);
    aniso[i * 4] = Math.round(clamp(AN[i * 3], 0, 1) * 255);
    aniso[i * 4 + 1] = Math.round(clamp(AN[i * 3 + 1], 0, 1) * 255);
    aniso[i * 4 + 2] = Math.round(clamp(AN[i * 3 + 2] * cov, 0, 1) * 255);
    aniso[i * 4 + 3] = 255;
  }
  return { albedo, normal, aniso, px };
}

// ---------------------------------------------------------------------------
// The demo design: a small tree. Back-stitch trunk and branches, satin leaves,
// French-knot fruit, running-stitch ground with straight-stitch grass.
export function treeDesign(k = 1) {
  const out = [];
  const rnd = mulberry32(42);
  const bark = hsl(24, 42, 27), bark2 = hsl(28, 38, 36);
  const greens = [hsl(112, 38, 30), hsl(96, 42, 40), hsl(132, 34, 23), hsl(84, 40, 46)];
  const red = hsl(2, 74, 40), ground = hsl(88, 28, 38);

  const polyline = (pts, step, w, col, mat) => {
    // resample by arc length into back stitches of ~step mm
    const segs = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
    let acc = [pts[0]], carry = 0;
    for (const [p, q] of segs) {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      let t = step - carry;
      while (t <= L) { acc.push([p[0] + (q[0] - p[0]) * t / L, p[1] + (q[1] - p[1]) * t / L]); t += step; }
      carry = L - (t - step);
    }
    acc.push(pts[pts.length - 1]);
    for (let i = 1; i < acc.length; i++) out.push({ kind: 'stitch', a: acc[i - 1], b: acc[i], w, col, mat });
  };
  const curve = (f, n = 40) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

  // ground: running stitch with gaps
  for (let x = -37 * k; x < 36 * k; x += 4.6) {
    const y0 = -38 * k + 0.7 * Math.sin(x * 0.18), y1 = -38 * k + 0.7 * Math.sin((x + 3) * 0.18);
    out.push({ kind: 'stitch', a: [x, y0], b: [x + 3, y1], w: 0.7, col: ground, mat: 'floss' });
  }
  // grass tufts: fans of straight stitches
  for (const gx of [-30, -21, -9, 11, 22, 31].map((g) => g * k)) {
    for (let j = -1; j <= 1; j++) {
      const ang = Math.PI / 2 + j * 0.38 + (rnd() - 0.5) * 0.15, L = 3.5 + rnd() * 1.8;
      out.push({ kind: 'stitch', a: [gx + j * 0.5, -37.2 * k], b: [gx + j * 0.5 + Math.cos(ang) * L, -37.2 * k + Math.sin(ang) * L], w: 0.6, col: greens[(j + 4) % 4], mat: 'floss' });
    }
  }
  // trunk: three adjacent back-stitch lines that taper toward the top (stem-like)
  for (const off of [-1.7, -0.57, 0.57, 1.7]) {
    polyline(curve((t) => [off * (1 - 0.5 * t) + 1.3 * k * Math.sin(t * 2.6), (-37.6 + t * 44) * k]), 2.3, 0.95, Math.abs(off) < 1 ? bark2 : bark, 'perle');
  }
  // branches
  const branches = [
    [[0.9, -6], [-5, 0], [-11, 5], [-16, 9]],
    [[1.6, -3], [6, 2], [11, 7], [15, 12]],
    [[1.2, 2], [-2, 9], [-4, 15]],
    [[1.5, 3], [4.5, 10], [5.5, 17]],
  ];
  for (const b of branches) polyline(b.map(([x, y]) => [x * k, y * k]), 2.2, 0.8, bark, 'perle');

  // canopy: satin-stitch leaves on two elliptical rings + centre
  const cx = 0, cy = 15 * k;
  const leaves = [];
  const ring = (n, rx, ry, L, W, a0) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + (rnd() - 0.5) * 0.2;
      leaves.push({ c: [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k], ang: a + (rnd() - 0.5) * 0.35, L: L * k * (0.9 + rnd() * 0.2), W: W * k * (0.9 + rnd() * 0.2) });
    }
  };
  ring(13, 21, 16, 11.5, 5.2, 0.1);
  ring(8, 11, 8.5, 10.5, 4.8, 0.45);
  leaves.push({ c: [cx, cy + 1 * k], ang: Math.PI / 2 + 0.2, L: 10 * k, W: 4.6 * k });
  let li = 0;
  for (const lf of leaves) {
    const col = greens[li++ % 4];
    const ax = Math.cos(lf.ang), ay = Math.sin(lf.ang), qx = -ay, qy = ax;
    for (let s = -lf.L / 2 + 0.4; s <= lf.L / 2 - 0.4; s += 0.52) {
      const t = s / lf.L + 0.5;
      const hwid = (lf.W / 2) * Math.pow(Math.sin(Math.PI * t), 0.75);
      if (hwid < 0.35) continue;
      const skew = hwid * 0.35;            // slanted satin
      const mx = lf.c[0] + ax * s, my = lf.c[1] + ay * s;
      out.push({ kind: 'stitch', a: [mx + qx * hwid - ax * skew, my + qy * hwid - ay * skew], b: [mx - qx * hwid + ax * skew, my - qy * hwid + ay * skew], w: 0.62, col, mat: 'floss' });
    }
  }
  // fruit: French knots
  for (let n = 0; n < 9; n++) {
    const a = rnd() * TAU, r = 0.35 + rnd() * 0.6;
    out.push({ kind: 'knot', c: [cx + Math.cos(a) * 19 * r * k, cy + Math.sin(a) * 14 * r * k], r: 1.15, col: red });
  }
  return out;
}
