// Which screen you are on, which product, its colour, the hoop size and where it sits.
import { create } from 'zustand';
import { products, productIds, type HoopSize, type Placement, type ProductId } from '../model/products';
import type { HSL } from '../model/types';

export type Screen = 'product' | 'stitch' | 'finished';
export type DesignTool = 'move' | 'pen' | 'eraser' | 'image';

interface AppState {
  screen: Screen;
  product: ProductId;
  colors: Record<ProductId, HSL>;
  hoopSize: HoopSize; // the current product's hoop
  hoopSizes: Record<ProductId, HoopSize>; // each product keeps its own hoop size
  placement: Record<ProductId, Placement>;
  tool: DesignTool;
  penWidthMm: number;
  modelVersion: number; // bumps when a product model has loaded (hoop-fit answers may change)
  pieceId: string | null; // the saved piece this work belongs to (null until first saved)
  pieceName: string | null;
  unsaved: boolean; // changed since it was last saved (or never saved)
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  modelError: { product: ProductId; message: string } | null; // a product model that failed to load
  set: (patch: Partial<Omit<AppState, 'set'>>) => void;
}

const by = <T>(f: (id: ProductId) => T) =>
  Object.fromEntries(productIds.map((id) => [id, f(id)])) as Record<ProductId, T>;

export const useApp = create<AppState>((set) => ({
  screen: 'product',
  product: 'tshirt',
  colors: by((id) => products[id].defaultColor),
  hoopSize: products.tshirt.defaultHoop,
  hoopSizes: by((id) => products[id].defaultHoop),
  placement: by((id) => ({ ...products[id].presets[0]!.placement })),
  tool: 'move',
  penWidthMm: 1.2,
  modelVersion: 0,
  pieceId: null,
  pieceName: null,
  unsaved: false,
  saveStatus: 'idle',
  modelError: null,
  // Changing product brings back that product's hoop size; changing the size remembers it.
  set: (patch) =>
    set((s) => {
      const product = patch.product ?? s.product;
      const hoopSizes = { ...s.hoopSizes, ...patch.hoopSizes };
      const next = { ...patch };
      if (patch.hoopSize !== undefined) hoopSizes[product] = patch.hoopSize;
      else if (product !== s.product) next.hoopSize = hoopSizes[product];
      return { ...next, hoopSizes };
    }),
}));
