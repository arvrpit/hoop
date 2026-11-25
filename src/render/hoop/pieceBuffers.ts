// Instance buffers for stitches, knots and hole dimples. Filled and animated by StitchLayer.
import { GrowableInstances, centredQuad, stitchQuad } from './instances';

export interface PieceBuffers {
  stitches: GrowableInstances;
  knots: GrowableInstances;
  dimples: GrowableInstances;
}

export function createPieceBuffers(): PieceBuffers {
  return {
    stitches: new GrowableInstances(stitchQuad(), [
      { name: 'iAB', itemSize: 4 },
      { name: 'iMeta', itemSize: 4 },
    ]),
    knots: new GrowableInstances(centredQuad(), [
      { name: 'iKnot', itemSize: 4 },
      { name: 'iKnotMeta', itemSize: 4 },
    ]),
    dimples: new GrowableInstances(centredQuad(), [{ name: 'iDimple', itemSize: 4 }]),
  };
}
