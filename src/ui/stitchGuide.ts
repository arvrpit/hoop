// What each stitch does, as cross-sections for the toolbar's hover cards (like an instruction manual
// or a science-book cutaway). Pure data: the fabric slab, its holes, the thread's path through them,
// numbered passes, and a one-line description. Drawn by StitchDiagram.tsx.
//
// Diagram space: 240 × 116. The fabric is a slab from y = 58 (front face) to y = 70 (back face);
// above it is the front (what you see), below it the back.
import type { StitchType } from '../model/types';

export const FABRIC_TOP = 58;
export const FABRIC_BOTTOM = 70;
const T = FABRIC_TOP;
const B = FABRIC_BOTTOM;

export interface Pass {
  x: number; // the hole
  n: string; // its number(s) in stitching order, e.g. "1" or "3·6"
  way: 'up' | 'down'; // the needle's first pass through it
}

export interface StitchGuide {
  label: string;
  key: string;
  description: string;
  holes: number[]; // x of each hole cut through the slab
  passes: Pass[];
  thread: string; // SVG path of the thread, in stitching order (the needle follows it)
  ghost?: string; // a fainter earlier wrap (satin), drawn behind
  needle: 'follow' | 'down'; // ride along the thread, or (knot) plunge down beside it
  numbers?: 'above' | 'below'; // where the pass numbers sit (below when the action is all on top)
}

// Front stitches lie on the face; passes underneath lie on the back.
const over = (a: number, b: number) => `C${a},${T - 7} ${b},${T - 7} ${b},${T}`;
const under = (a: number, b: number, depth = 9) => `C${a},${B + depth} ${b},${B + depth} ${b},${B}`;
const upThrough = (x: number) => `L${x},${T}`;
const downThrough = (x: number) => `L${x},${B}`;

export const stitchGuides: Record<StitchType, StitchGuide> = {
  running: {
    label: 'Running stitch',
    key: 'R',
    description:
      'Up, down, up, down along a line. Even dashes on top; the thread runs underneath in the gaps.',
    holes: [34, 74, 114, 154, 194],
    passes: [
      { x: 34, n: '1', way: 'up' },
      { x: 74, n: '2', way: 'down' },
      { x: 114, n: '3', way: 'up' },
      { x: 154, n: '4', way: 'down' },
      { x: 194, n: '5', way: 'up' },
    ],
    thread: [
      `M16,${B + 22} C26,${B + 18} 34,${B + 10} 34,${B}`,
      upThrough(34),
      over(34, 74),
      downThrough(74),
      under(74, 114),
      upThrough(114),
      over(114, 154),
      downThrough(154),
      under(154, 194),
      upThrough(194),
      `C194,${T - 6} 208,${T - 11} 228,${T - 15}`,
    ].join(' '),
    needle: 'follow',
  },
  back: {
    label: 'Back stitch',
    key: 'B',
    description:
      'Each stitch goes back into the end of the last, so the line is solid on top. Underneath, the thread steps forward twice as far.',
    holes: [40, 80, 120, 160, 200],
    passes: [
      { x: 80, n: '1·4', way: 'up' },
      { x: 40, n: '2', way: 'down' },
      { x: 120, n: '3·6', way: 'up' },
      { x: 160, n: '5', way: 'up' },
      { x: 200, n: '7', way: 'up' },
    ],
    thread: [
      `M62,${B + 24} C72,${B + 20} 80,${B + 10} 80,${B}`,
      upThrough(80),
      over(80, 40),
      downThrough(40),
      under(40, 120, 16),
      upThrough(120),
      over(120, 80),
      downThrough(80),
      under(80, 160, 24),
      upThrough(160),
      over(160, 120),
      downThrough(120),
      under(120, 200, 16),
      upThrough(200),
      `C200,${T - 6} 214,${T - 10} 234,${T - 13}`,
    ].join(' '),
    needle: 'follow',
  },
  satin: {
    label: 'Satin stitch',
    key: 'S',
    description:
      'Long stitches laid side by side to fill a shape. The thread wraps around: across the top, then straight back underneath to start the next one.',
    holes: [60, 180],
    passes: [
      { x: 60, n: '1·3', way: 'up' },
      { x: 180, n: '2', way: 'down' },
    ],
    // One full wrap (seen edge-on), then the needle comes up beside 1 for the next.
    thread: [
      `M40,${B + 22} C52,${B + 18} 60,${B + 10} 60,${B}`,
      upThrough(60),
      `C60,${T - 9} 180,${T - 9} 180,${T}`,
      downThrough(180),
      `C180,${B + 4} 60,${B + 4} 60,${B}`,
      upThrough(60),
      `C60,${T - 6} 74,${T - 11} 96,${T - 15}`,
    ].join(' '),
    // The wrap before it, one row back (drawn faint and offset, like the next layer in a cutaway).
    ghost: [
      `M66,${T - 3} C66,${T - 12} 186,${T - 12} 186,${T - 3}`,
      `M186,${B - 3} C186,${B + 1} 66,${B + 1} 66,${B - 3}`,
    ].join(' '),
    needle: 'follow',
  },
  knot: {
    label: 'French knot',
    key: 'K',
    description:
      'Come up, wrap the thread twice around the needle, and go back down just beside where you came up. The wraps tighten into a knot on top.',
    holes: [104, 124],
    passes: [
      { x: 104, n: '1', way: 'up' },
      { x: 124, n: '2', way: 'down' },
    ],
    // Up through 1, then two turns around the needle shaft (which stands over hole 2), then the
    // tail held taut while the needle goes down.
    thread: [
      `M66,${B + 14} C80,${B + 14} 104,${B + 10} 104,${B}`,
      upThrough(104),
      `C104,${T - 8} 110,${T - 12} 117,${T - 13}`,
      `C121,${T - 14} 132,${T - 14} 132,${T - 17}`,
      `C132,${T - 20} 116,${T - 20} 116,${T - 23}`,
      `C116,${T - 26} 132,${T - 25} 132,${T - 28}`,
      `C132,${T - 31} 120,${T - 32} 116,${T - 32}`,
      `C108,${T - 32} 98,${T - 36} 88,${T - 44}`,
    ].join(' '),
    numbers: 'below',
    needle: 'down',
  },
};
