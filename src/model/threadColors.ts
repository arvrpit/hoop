// Ready-made embroidery colours (the picker's colour card) and plain colour names for new threads.
import { converter } from 'culori';
import { hexToRgb255, type RGB255 } from './color';

export interface NamedColor {
  name: string;
  hex: string;
}

/** The colour card in the thread picker: one click picks a typical floss colour. */
export const flossCard: NamedColor[] = [
  { name: 'Bark brown', hex: '#6f472a' },
  { name: 'Leaf green', hex: '#4f7a3a' },
  { name: 'Moss', hex: '#7d8a3c' },
  { name: 'Sunflower', hex: '#e8b628' },
  { name: 'Coral', hex: '#e0735a' },
  { name: 'Cherry red', hex: '#b8282e' },
  { name: 'Rose pink', hex: '#e4a0b2' },
  { name: 'Lavender', hex: '#9a88c4' },
  { name: 'Sky blue', hex: '#7fb0d8' },
  { name: 'Navy', hex: '#253a6b' },
  { name: 'Ecru', hex: '#efe6d2' },
  { name: 'Charcoal', hex: '#2f2c2b' },
];

/** More names, so any colour gets a sensible one. */
const moreNames: NamedColor[] = [
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#fafafa' },
  { name: 'Grey', hex: '#8a8a8a' },
  { name: 'Silver', hex: '#c4c4c4' },
  { name: 'Cream', hex: '#f3e9c9' },
  { name: 'Sand', hex: '#d8c39a' },
  { name: 'Tan', hex: '#b48a5e' },
  { name: 'Chocolate', hex: '#4a2c1d' },
  { name: 'Rust', hex: '#a24a22' },
  { name: 'Terracotta', hex: '#c0613f' },
  { name: 'Orange', hex: '#e57a22' },
  { name: 'Peach', hex: '#f2b38f' },
  { name: 'Mustard', hex: '#c99a1e' },
  { name: 'Lemon', hex: '#f3e04b' },
  { name: 'Olive', hex: '#6b6b2a' },
  { name: 'Sage', hex: '#9bb08a' },
  { name: 'Mint', hex: '#a8dcc0' },
  { name: 'Forest green', hex: '#24502f' },
  { name: 'Emerald', hex: '#1f8a5b' },
  { name: 'Teal', hex: '#1f7a7a' },
  { name: 'Turquoise', hex: '#3cbac2' },
  { name: 'Denim', hex: '#4a6f9e' },
  { name: 'Cobalt', hex: '#2a52be' },
  { name: 'Indigo', hex: '#3a2f7a' },
  { name: 'Violet', hex: '#7b4bb3' },
  { name: 'Plum', hex: '#6b2f5b' },
  { name: 'Magenta', hex: '#c0307f' },
  { name: 'Fuchsia', hex: '#d64ca0' },
  { name: 'Burgundy', hex: '#6e1f2e' },
  { name: 'Blush', hex: '#f0c8c8' },
  { name: 'Slate', hex: '#5a6470' },
];

const toOklab = converter('oklab');
const lab = (c: RGB255) => toOklab({ mode: 'rgb', r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 });
const named = [...flossCard, ...moreNames].map((n) => ({ ...n, lab: lab(hexToRgb255(n.hex)!) }));

/** The closest plain colour name (measured in OKLab, so it matches what the eye sees). */
export function colorName(c: RGB255): string {
  const p = lab(c);
  let best = named[0]!;
  let bestD = Infinity;
  for (const n of named) {
    const d = (n.lab.l - p.l) ** 2 + (n.lab.a - p.a) ** 2 + (n.lab.b - p.b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best.name;
}

/** `name`, or "name 2", "name 3"… if a thread already has it. */
export function uniqueName(name: string, taken: string[]): string {
  const set = new Set(taken.map((t) => t.toLowerCase()));
  if (!set.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) if (!set.has(`${name} ${i}`.toLowerCase())) return `${name} ${i}`;
}

let counter = 0;
export function newThreadId(): string {
  counter += 1;
  return `t-${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
