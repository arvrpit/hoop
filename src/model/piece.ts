import { fabrics, tuning } from '../tuning';
import type { FabricId, HSL, Piece, Thread } from './types';

export function createPiece(opts: {
  id: string;
  now: string;
  fabric?: FabricId;
  fabricColor?: HSL;
  hoopDiameterMm?: Piece['hoopDiameterMm'];
  threads?: Thread[];
}): Piece {
  const fabric = opts.fabric ?? 'cotton';
  const threads = opts.threads ?? [];
  return {
    id: opts.id,
    version: 1,
    fabric,
    fabricColor: opts.fabricColor ?? fabrics[fabric].defaultColor,
    hoopDiameterMm: opts.hoopDiameterMm ?? (tuning.hoopDefaultDiameterMm as Piece['hoopDiameterMm']),
    threads: threads.map((t) => ({ ...t, color: { ...t.color } })),
    runs: [],
    activeThreadId: threads[0]?.id ?? null,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}
