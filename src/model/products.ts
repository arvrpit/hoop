// Products you can embroider (spec 9.3). Pure config. Placement lives in each product's flat
// "panel" coordinates: millimetres, u to the right, v growing downward (like a sewing pattern).
import type { FabricId, HSL } from './types';

export type ProductId = 'tshirt' | 'tote' | 'notebook';
export type HoopSize = 100 | 150 | 200;
export const hoopSizes: HoopSize[] = [100, 150, 200];

export interface Placement {
  panel: string; // which flat panel of the product
  u: number; // hoop centre, panel mm
  v: number;
}

export interface ProductDef {
  id: ProductId;
  label: string;
  fabric: FabricId; // what you stitch into
  defaultColor: HSL;
  defaultHoop: HoopSize; // the largest hoop that sits well on it
  swatches: { name: string; color: HSL }[];
  presets: { id: string; label: string; placement: Placement }[];
  panels: { id: string; label: string }[];
  credit?: { text: string; url: string; license: { text: string; url: string } };
}

export const products: Record<ProductId, ProductDef> = {
  tshirt: {
    id: 'tshirt',
    label: 'T-shirt',
    fabric: 'jersey',
    defaultHoop: 150,
    defaultColor: { h: 40, s: 12, l: 92 },
    swatches: [
      { name: 'White', color: { h: 40, s: 12, l: 92 } },
      { name: 'Heather grey', color: { h: 30, s: 4, l: 64 } },
      { name: 'Black', color: { h: 220, s: 8, l: 14 } },
      { name: 'Navy', color: { h: 220, s: 40, l: 22 } },
      { name: 'Sage', color: { h: 100, s: 14, l: 58 } },
      { name: 'Rust', color: { h: 18, s: 52, l: 40 } },
    ],
    panels: [
      { id: 'front', label: 'Front' },
      { id: 'back', label: 'Back' },
    ],
    presets: [
      { id: 'chest', label: 'Chest centre', placement: { panel: 'front', u: 0, v: -170 } },
      { id: 'left-chest', label: 'Left chest', placement: { panel: 'front', u: 95, v: -215 } },
      { id: 'upper-back', label: 'Upper back', placement: { panel: 'back', u: 0, v: -190 } },
    ],
    credit: {
      text: 'T-shirt model: "T Shirt" by funlab117 (Sketchfab)',
      url: 'https://sketchfab.com/funlab117',
      license: { text: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    },
  },
  tote: {
    id: 'tote',
    label: 'Tote bag',
    fabric: 'canvas',
    defaultHoop: 150,
    defaultColor: { h: 38, s: 24, l: 84 },
    swatches: [
      { name: 'Natural', color: { h: 38, s: 24, l: 84 } },
      { name: 'Black', color: { h: 30, s: 6, l: 14 } },
      { name: 'Olive', color: { h: 70, s: 22, l: 36 } },
      { name: 'Navy', color: { h: 222, s: 36, l: 24 } },
      { name: 'Mustard', color: { h: 42, s: 62, l: 50 } },
    ],
    panels: [{ id: 'front', label: 'Front' }],
    presets: [
      { id: 'centre', label: 'Front centre', placement: { panel: 'front', u: 0, v: 20 } },
      { id: 'upper-left', label: 'Upper left', placement: { panel: 'front', u: -85, v: -105 } },
    ],
    credit: {
      text: 'Tote bag model: "Uploads_files_2167121_ Tote Bag" by MoonOctopus (Sketchfab)',
      url: 'https://skfb.ly/oI9XC',
      license: { text: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    },
  },
  notebook: {
    id: 'notebook',
    label: 'Notebook',
    fabric: 'linen',
    defaultHoop: 100,
    defaultColor: { h: 30, s: 18, l: 62 },
    swatches: [
      { name: 'Oat', color: { h: 38, s: 22, l: 78 } },
      { name: 'Clay', color: { h: 16, s: 34, l: 52 } },
      { name: 'Sage', color: { h: 96, s: 16, l: 52 } },
      { name: 'Ink', color: { h: 220, s: 30, l: 22 } },
      { name: 'Taupe', color: { h: 30, s: 18, l: 62 } },
    ],
    panels: [{ id: 'front', label: 'Front cover' }],
    presets: [
      { id: 'centre', label: 'Front centre', placement: { panel: 'front', u: 0, v: 0 } },
      { id: 'lower-right', label: 'Lower right', placement: { panel: 'front', u: 14, v: 40 } },
    ],
    credit: {
      text: 'Notebook model: "PB153 Notebook Mid" by SCANIMAT (Sketchfab)',
      url: 'https://skfb.ly/6x6sH',
      license: { text: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    },
  },
};

export const productIds: ProductId[] = ['tshirt', 'tote', 'notebook'];
