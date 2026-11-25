// Moving between the product screen, the hoop and the finished piece, and saving pieces.
// One piece at a time: a product, its colour, hoop and spot, the design guide, and the stitches.
import { products, type ProductId } from '../model/products';
import { cloneData, newPieceId, pieceName, type SavedPiece } from '../model/savedPiece';
import { designLayer } from '../render/design/designCanvas';
import { productRuntime } from '../render/product/runtime';
import { tuning } from '../tuning';
import { useApp } from './app';
import { camera } from './camera';
import { useDesign } from './design';
import { session } from './session';
import { useShelf } from './shelf';
import { useHoop } from './store';
import { askConfirm } from './ui';

export const fader = { fade: async (_out: boolean): Promise<void> => {} };

export function enterStitch(): void {
  const { product, colors, hoopSize } = useApp.getState();
  const def = products[product];
  useHoop
    .getState()
    .set({ fabric: def.fabric, fabricColor: colors[product], hoopDiameterMm: hoopSize, source: 'product' });
  camera.jumpTo({ zoom: 1, focus: { x: 0, y: 0 } });
  useHoop.setState({ zoom: 1, focus: { x: 0, y: 0 } });
  session.activate(def.fabric, hoopSize);
  designLayer.setHoop(hoopSize);
  useApp.getState().set({ screen: 'stitch', tool: 'move' });
}

export async function startStitching(): Promise<void> {
  await productRuntime.faceHoop();
  await fader.fade(true);
  enterStitch();
  await fader.fade(false);
}

export async function backToProduct(): Promise<void> {
  await fader.fade(true);
  useApp.getState().set({ screen: 'product', tool: 'move' });
  await fader.fade(false);
}

/** Save & render: tie off, take the piece out of the hoop, show it finished, and save it. */
export async function finishAndSave(): Promise<void> {
  session.tieOff();
  await fader.fade(true);
  useApp.getState().set({ screen: 'finished', tool: 'move', saveStatus: 'saving' });
  await fader.fade(false);
  await productRuntime.whenReady();
  await productRuntime.faceHoop(tuning.finishedFraming);
  await saveCurrent();
}

/** Write the current piece to Your pieces (a new entry, or the one it was opened from). */
export async function saveCurrent(): Promise<void> {
  const app = useApp.getState();
  const piece = session.snapshot();
  if (!piece) return;
  const thumb = productRuntime.capture({ maxWidth: tuning.thumbnailPx });
  const now = new Date();
  const shelf = useShelf.getState();
  const existing = app.pieceId ? await shelf.get(app.pieceId).catch(() => null) : null;
  const id = existing?.id ?? newPieceId(now);
  const name = existing?.name ?? pieceName(products[app.product].label, now);
  const d = useDesign.getState();
  const record: SavedPiece = {
    id,
    name,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    product: app.product,
    color: { ...app.colors[app.product] },
    hoopSize: app.hoopSize,
    placement: { ...app.placement[app.product] },
    design: cloneData({ strokes: d.strokes, image: d.image, visible: d.visible, opacity: d.opacity }),
    piece,
    thumbnail: thumb ? thumb.toDataURL('image/jpeg', 0.82) : '',
  };
  try {
    await shelf.put(record);
    useApp.getState().set({ pieceId: id, pieceName: name, saveStatus: 'saved' });
    useApp.getState().set({ unsaved: false });
  } catch {
    useApp.getState().set({ saveStatus: 'failed' });
  }
}

/** Open a saved piece: it shows finished on its product; Keep stitching puts it back in the hoop. */
export async function openSaved(id: string): Promise<void> {
  const rec = await useShelf.getState().get(id);
  if (!rec) return;
  await fader.fade(true);
  session.loadPiece(rec.piece);
  const app = useApp.getState();
  app.set({
    product: rec.product,
    colors: { ...app.colors, [rec.product]: rec.color },
    hoopSize: rec.hoopSize,
    placement: { ...app.placement, [rec.product]: rec.placement },
    pieceId: rec.id,
    pieceName: rec.name,
    screen: 'finished',
    tool: 'move',
    saveStatus: 'saved',
  });
  useDesign.getState().set({
    strokes: rec.design.strokes,
    image: rec.design.image,
    visible: rec.design.visible,
    opacity: rec.design.opacity,
  });
  useDesign.setState({ past: [] });
  designLayer.setHoop(rec.hoopSize);
  useApp.getState().set({ unsaved: false });
  await fader.fade(false);
  await productRuntime.whenReady();
  await productRuntime.faceHoop(tuning.finishedFraming);
}

/** Start a fresh piece (optionally on another product): no stitches, no design. */
export async function newPiece(product?: ProductId): Promise<void> {
  const fade = useApp.getState().screen !== 'product';
  if (fade) await fader.fade(true);
  session.newPiece();
  useDesign.setState((s) => ({ strokes: [], image: null, past: [], version: s.version + 1 }));
  useApp.getState().set({
    ...(product ? { product } : {}),
    pieceId: null,
    pieceName: null,
    screen: 'product',
    tool: 'move',
    saveStatus: 'idle',
  });
  useApp.getState().set({ unsaved: false });
  if (fade) await fader.fade(false);
}

/** Download the finished render as a PNG, at least `downloadPixelRatio` sharp. */
export async function downloadImage(): Promise<void> {
  const ratio = Math.max(tuning.downloadPixelRatio, window.devicePixelRatio || 1);
  const c = productRuntime.capture({ pixelRatio: ratio });
  if (!c) return;
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) return;
  const { pieceName: name, product } = useApp.getState();
  const slug = (name ?? products[product].label).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hoop-${slug.toLowerCase()}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** If the current piece has unsaved stitches, ask before replacing it. */
export async function okToLeaveCurrent(nextLabel: string): Promise<boolean> {
  const { unsaved } = useApp.getState();
  if (!session.pieceHasStitches() || !unsaved) return true;
  return askConfirm({
    title: `Discard unsaved stitches?`,
    body: `This piece has stitches that aren't saved yet. ${nextLabel} will replace it.`,
    confirm: 'Discard stitches',
    cancel: 'Go back',
    danger: true,
  });
}

// Anything that changes the piece marks it unsaved.
const markUnsaved = () => {
  if (!useApp.getState().unsaved) useApp.getState().set({ unsaved: true });
};
session.onEvent((e) => {
  if (e.kind === 'previewThreads') return;
  if (e.kind !== 'rebuild' || e.change) markUnsaved();
});
useDesign.subscribe((s, p) => {
  if (s.version !== p.version) markUnsaved();
});
useApp.subscribe((s, p) => {
  if (s.colors !== p.colors || s.placement !== p.placement || s.hoopSize !== p.hoopSize) markUnsaved();
});
