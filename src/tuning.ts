// Every number that affects how Hoop looks and feels lives in this file.
// Edit a value, save, and the dev server reloads with it.
// Units: millimetres (mm), milliseconds (ms), degrees (deg). Colours are HSL (h 0–360, s/l 0–100).

import type { FabricId, ThreadMaterial } from './model/types';

export const tuning = {
  // camera
  focusZoom: 3, // zoom at which the lamp has fully moved with the camera
  maxZoom: 8,
  reducedMotionCutMs: 150,
  fitMs: 450, // Fit hoop (the only camera move, and only when asked)
  overviewMargin: 1.12, // hoop outer diameter × this = visible height at 1× zoom

  // moving around
  dragThresholdPx: 4, // a press that moves less than this is a click, more is a drag
  wheelZoomSpeed: 0.0015, // Windows mouse wheel (and ⌘ + wheel on a Mac mouse)
  pinchZoomSpeed: 0.01, // trackpad pinch

  // stitching
  pullThroughMs: 380,
  knotPopMs: 220,
  unpickMs: 200,
  softMaxStitchMm: 12,
  hardMaxStitchMm: 25,
  snapRadius: 1.2, // × hole spacing
  holeCrowdWarn: 4, // the ring warns when a click would be this many passes through one hole
  holeCrowdMax: 6, // …and refuses this many (real fabric distorts, bunches or tears)
  existingHoleMagnet: 1.6, // × hole spacing: how far away an already-used hole can pull the needle
  existingHoleBias: 0.35, // × hole spacing: a used hole wins only if it is at most this much farther than the nearest free hole (so the next hole along stays reachable for satin)
  longPressMs: 500, // press and hold on a stitch this long to pick up its thread (the eyedropper; or Alt/Option+click)
  rethreadMs: 550, // the rack's glint when a thread goes on the needle (never blocks clicks)
  rackCloseDelayMs: 350, // the thread drawer tucks away this long after the pointer leaves it

  // aiming (the intent layer: crosshair, hole ring, guideline; drawn as interface, never as thread)
  guideFrontOpacity: 0.55,
  guideBackOpacity: 0.3,
  crosshairArmPx: 11,
  crosshairGapPx: 5,
  chevronRadiusPx: 21, // in/out chevrons sit this far from the aim point (just past the crosshair arms)
  chevronSizePx: 4, // half-height of each chevron
  chevronTravelPx: 5, // how far they drift in or out on each pulse
  eyedropperMinMm: 0.35, // a thin stitch still counts as under the pointer within this distance…
  eyedropperSlopPx: 6, // …or within this many screen pixels (so the gaps between satin rows count)
  toastMs: 1800, // short notes like "Picked up Leaf green"
  previewSweepMs: 4200, // the thread picker's preview: one slow pass of the light across the satin
  previewFps: 24, // …redrawn this often while it sweeps
  chevronCycleMs: 1100, // one pulse (a knot pulses out, then in, over two of these)
  ringMinPx: 6, // hole ring radius never smaller than this on screen
  tugMs: 280, // guideline wiggle when a stitch is too long
  dimpleFadeMs: 120,
  stitchDiagramMs: 3600, // the toolbar's cross-section diagrams: one pass of the needle (then a short hold)
  stitchDiagramDelayMs: 180, // hover this long before the diagram card opens

  // lighting
  keyElevationDeg: 25, // low "window" light; grazing light is what reveals weave and raised stitches
  keyAzimuthDeg: 135, // from upper-left (0 = from the right, 90 = from the top)
  keyIntensity: 0.95,
  keyColor: { h: 38, s: 40, l: 92 }, // warm daylight
  ambientIntensity: 0.48,
  ambientColor: { h: 30, s: 30, l: 86 }, // soft warm fill
  lampHeightMm: 160, // focus lamp height above the fabric
  lampIntensity: 0.5,
  lampColor: { h: 42, s: 70, l: 90 },
  lampRadiusFocusMm: 45, // only used if the lamp is set to follow the camera (look panel)
  lampRadiusOverviewMm: 140, // the lamp stays still: one wide, even pool over the hoop
  edgeDimFocus: 0.15, // how much hoop edges dim in Focus
  edgeDimOverview: 0.04,
  threadExposure: 0.76, // round threads catch more grazing light than flat fabric; this keeps stitched colour true to its swatch
  specViewTiltDeg: 22, // highlights are computed for an eye tilted this far towards the bottom of the screen

  // shading
  stitchShadowOffsetMm: 0.3,
  stitchShadowOpacity: 0.25,
  stitchShadowBlurMm: 0.22, // softness of the cast shadow edge
  contactShadowOpacity: 0.18, // thin ambient-occlusion rim right under each thread
  dimpleOpacity: 0.32, // darkened dimple where thread enters a hole
  dimpleRadiusMm: 0.3,
  jitterWidth: 0.08,
  jitterLightness: 0.03,
  jitterEndpointMm: 0.08,
  endTaperMm: 0.3, // threads pinch and darken over this length where they dive into a hole
  endDarken: 0.45,

  // hoop
  hoopDefaultDiameterMm: 150,

  // product screen and the finished piece
  faceHoopFraming: 1.9, // facing the hoop to draw: visible height = hoop diameter × this
  finishedFraming: 2.8, // the finished render: a little more of the product around the embroidery
  thumbnailPx: 360, // shelf thumbnail width
  downloadPixelRatio: 2, // Download image renders at least this sharp
  hoopRingWidthMm: 9,
  hoopRingHeightMm: 3.2, // how far the outer ring stands above the fabric (drives its cast shadow)
  hoopWoodColor: { h: 33, s: 42, l: 64 },
  holeMarginMm: 3, // points closer than this to the ring are not valid holes

  // background (tabletop)
  tableColor: { h: 24, s: 22, l: 21 },
  tableVignette: 0.55,
} as const;

export interface FabricParams {
  label: string;
  holeSpacingMm: number; // distance between holes. Woven fabrics: the needle only goes through the gaps the weave leaves (felt: free placement quantised to this)
  latticeKind: 'grid' | 'free';
  threadsPerMm: number; // yarns per mm in each direction (aida: threads per mm inside a block)
  defaultColor: { h: number; s: number; l: number };
  yarnWidth: number; // fraction of the yarn pitch the yarn fills (1 = no gaps)
  yarnHeight: number; // relief depth, in yarn pitches
  crimp: number; // how much yarns dip over/under each other, in yarn pitches
  colorVariation: number; // ± lightness variation between yarns (0.025 = ±2.5%)
  slub: number; // linen slubs: thick/thin variation along the yarn
  holeSizeMm: number; // aida only: visible hole size
  fibreScaleMm: number; // felt only
  sheen: number; // tiny fabric gloss (cotton/aida are matte)
}

// Spec 6.2. Holes are the gaps the weave leaves: plain weave between every pair of yarns, Aida at block corners.
export const fabrics: Record<FabricId, FabricParams> = {
  cotton: {
    label: 'Cotton',
    holeSpacingMm: 0.45, // every gap between yarns (= 1 / threadsPerMm)
    latticeKind: 'grid',
    threadsPerMm: 1 / 0.45,
    defaultColor: { h: 40, s: 25, l: 88 },
    yarnWidth: 0.94,
    yarnHeight: 0.24,
    crimp: 0.1,
    colorVariation: 0.022,
    slub: 0,
    holeSizeMm: 0,
    fibreScaleMm: 0,
    sheen: 0.02,
  },
  linen: {
    label: 'Linen',
    holeSpacingMm: 0.625, // every gap between yarns (= 1 / threadsPerMm)
    latticeKind: 'grid',
    threadsPerMm: 1.6,
    defaultColor: { h: 38, s: 22, l: 78 },
    yarnWidth: 0.8,
    yarnHeight: 0.3,
    crimp: 0.14,
    colorVariation: 0.035,
    slub: 0.35,
    holeSizeMm: 0,
    fibreScaleMm: 0,
    sheen: 0.05,
  },
  aida14: {
    label: 'Aida 14',
    holeSpacingMm: 25.4 / 14,
    latticeKind: 'grid',
    threadsPerMm: 4 / (25.4 / 14), // 4 threads per block
    defaultColor: { h: 45, s: 15, l: 95 },
    yarnWidth: 0.92,
    yarnHeight: 0.34,
    crimp: 0.24,
    colorVariation: 0.015,
    slub: 0.04,
    holeSizeMm: 0.4,
    fibreScaleMm: 0,
    sheen: 0.02,
  },
  jersey: {
    label: 'Cotton jersey (T-shirt)',
    holeSpacingMm: 0.7, // the gaps between knit loops: one per loop (wale × course)
    latticeKind: 'grid',
    threadsPerMm: 1 / 0.7, // loops per mm
    defaultColor: { h: 40, s: 12, l: 92 },
    yarnWidth: 0.52, // loop leg width, as a fraction of the loop
    yarnHeight: 0.3,
    crimp: 0,
    colorVariation: 0.018,
    slub: 0,
    holeSizeMm: 0,
    fibreScaleMm: 0,
    sheen: 0.03,
  },
  canvas: {
    label: 'Cotton canvas (tote)',
    holeSpacingMm: 1 / 1.4, // every gap between the heavy yarns
    latticeKind: 'grid',
    threadsPerMm: 1.4,
    defaultColor: { h: 38, s: 24, l: 84 },
    yarnWidth: 0.95,
    yarnHeight: 0.32,
    crimp: 0.12,
    colorVariation: 0.025,
    slub: 0.08,
    holeSizeMm: 0,
    fibreScaleMm: 0,
    sheen: 0.02,
  },
  felt: {
    label: 'Wool felt',
    holeSpacingMm: 0.3,
    latticeKind: 'free',
    threadsPerMm: 0,
    defaultColor: { h: 20, s: 30, l: 45 },
    yarnWidth: 0,
    yarnHeight: 0.5,
    crimp: 0,
    colorVariation: 0.06,
    slub: 0,
    holeSizeMm: 0,
    fibreScaleMm: 0.2,
    sheen: 0,
  },
};

export interface ThreadMaterialParams {
  label: string;
  widthPerStrandMm: number;
  defaultStrands: number;
  plies: number; // visible twisted plies per strand (spec's floss "6" was the skein's strands; one strand is 2-ply)
  twistPerMm: number; // full twists per mm along the thread
  twistSlope: number; // how far a ply groove leans across a strand (bigger = grooves lie closer to the thread's direction)
  plyDepth: number; // how deep the grooves between plies are (0–1)
  sheen: number; // anisotropic highlight strength
  specExponent: number; // highlight tightness along the fibre
  fuzz: number; // stray-fibre halo, as a fraction of thread width
  fibre: number; // fine fibrous texture strength
  strandSplit: number; // how visibly the separate strands lie side by side (0–1)
  flatten: number; // cross-section: 0 = round tube, 1 = flat ribbon (threads spread a little under tension)
  roughness: number; // used when baking for mockups (spec 9.1)
}

// Spec 6.3 starting values (tuned during M1).
export const threadMaterials: Record<ThreadMaterial, ThreadMaterialParams> = {
  floss: {
    label: 'Floss',
    widthPerStrandMm: 0.3,
    defaultStrands: 2,
    plies: 2,
    twistPerMm: 1.0,
    twistSlope: 1.3,
    plyDepth: 0.5,
    sheen: 0.22,
    specExponent: 30,
    fuzz: 0.15,
    fibre: 0.55,
    strandSplit: 0.6,
    flatten: 0.3,
    roughness: 0.6,
  },
  perle: {
    label: 'Perle',
    widthPerStrandMm: 0.45,
    defaultStrands: 2,
    plies: 2,
    twistPerMm: 0.6,
    twistSlope: 1.4,
    plyDepth: 0.75,
    sheen: 0.5,
    specExponent: 60,
    fuzz: 0.05,
    fibre: 0.3,
    strandSplit: 0,
    flatten: 0,
    roughness: 0.4,
  },
  silk: {
    label: 'Silk',
    widthPerStrandMm: 0.25,
    defaultStrands: 2,
    plies: 1,
    twistPerMm: 0.15,
    twistSlope: 0.4,
    plyDepth: 0.1,
    sheen: 0.95,
    specExponent: 120,
    fuzz: 0.02,
    fibre: 0.7,
    strandSplit: 0.35,
    flatten: 0.55,
    roughness: 0.25,
  },
  wool: {
    label: 'Wool',
    widthPerStrandMm: 0.55,
    defaultStrands: 2,
    plies: 2,
    twistPerMm: 0.45,
    twistSlope: 1.0,
    plyDepth: 0.5,
    sheen: 0.08,
    specExponent: 10,
    fuzz: 0.45,
    fibre: 0.5,
    strandSplit: 0.1,
    flatten: 0.35,
    roughness: 0.85,
  },
};

/** Knot impostor size: diameter = thread width × knotSizeFactor (spec: ~1.2 × 2.5). */
export const knotSizeFactor = 1.2 * 2.5;
