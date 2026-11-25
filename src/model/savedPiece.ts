// A saved piece: one embroidery on one product, everything needed to show it or reopen it in the
// hoop. Pure data (JSON-safe), stored in the browser by state/shelf.ts.
import type { HoopSize, Placement, ProductId } from './products';
import type { HSL, Piece, Vec2 } from './types';

export interface SavedStroke {
  points: Vec2[];
  widthMm: number;
  erase: boolean;
}

export interface SavedImage {
  src: string; // data URL
  pxW: number;
  pxH: number;
  x: number;
  y: number;
  widthMm: number;
  rotationDeg: number;
}

export interface SavedPiece {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  product: ProductId;
  color: HSL;
  hoopSize: HoopSize;
  placement: Placement;
  design: { strokes: SavedStroke[]; image: SavedImage | null; visible: boolean; opacity: number };
  piece: Piece; // the stitch engine's piece (threads, runs, punctures)
  thumbnail: string; // small JPEG data URL of the finished render
}

/** What the shelf lists (no stitches or design, so it stays light). */
export type PieceSummary = Pick<SavedPiece, 'id' | 'name' | 'product' | 'updatedAt' | 'thumbnail'>;

export const summarise = (p: SavedPiece): PieceSummary => ({
  id: p.id,
  name: p.name,
  product: p.product,
  updatedAt: p.updatedAt,
  thumbnail: p.thumbnail,
});

/** Deep copy through JSON: what is stored is exactly what can be read back. */
export function cloneData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

export function newPieceId(now: Date, rand: () => number = Math.random): string {
  return `p-${now.getTime().toString(36)}-${Math.floor(rand() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')}`;
}

/** "T-shirt · 24 Nov, 22:40" (local time). */
export function pieceName(productLabel: string, when: Date): string {
  const d = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const t = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${productLabel} · ${d}, ${t}`;
}
