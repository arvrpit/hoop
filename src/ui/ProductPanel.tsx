// Product screen controls: product, colour, hoop size and spot, the design (pen, eraser, image),
// and Start stitching. Floating card on the left.
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { hslToHex } from '../model/color';
import { hoopSizes, productIds, products, type ProductId } from '../model/products';
import { loadImageFile } from '../render/design/designCanvas';
import { productRuntime } from '../render/product/runtime';
import { useApp, type DesignTool } from '../state/app';
import { useDesign } from '../state/design';
import { newPiece, okToLeaveCurrent, startStitching } from '../state/flow';
import { session, useSession } from '../state/session';
import { askConfirm, useUi } from '../state/ui';
import { Shelf } from './Shelf';

const tools: { id: DesignTool; label: string; hint: string }[] = [
  { id: 'move', label: 'Move hoop', hint: 'Drag the hoop; drag elsewhere to turn the product' },
  { id: 'pen', label: 'Pen', hint: 'Draw inside the hoop' },
  { id: 'eraser', label: 'Eraser', hint: 'Rub out pen marks and image' },
  { id: 'image', label: 'Image', hint: 'Drag the image inside the hoop' },
];

export function ProductPanel() {
  const product = useApp((s) => s.product);
  const colors = useApp((s) => s.colors);
  const hoopSize = useApp((s) => s.hoopSize);
  const placement = useApp((s) => s.placement);
  const tool = useApp((s) => s.tool);
  const penWidth = useApp((s) => s.penWidthMm);
  const set = useApp((s) => s.set);
  const image = useDesign((s) => s.image);
  const hasDesign = useDesign((s) => s.strokes.length > 0 || s.image !== null);
  const canUndo = useDesign((s) => s.past.length > 0);
  const pieceId = useApp((s) => s.pieceId);
  const modelError = useApp((s) => s.modelError);
  const pieceName = useApp((s) => s.pieceName);
  const unsaved = useApp((s) => s.unsaved);
  useSessionPunctures();
  const stitched = session.pieceHasStitches();
  const [error, setError] = useState('');
  useApp((s) => s.modelVersion);
  const file = useRef<HTMLInputElement>(null);
  const def = products[product];

  const sizeState = (size: number) => {
    if (!productRuntime.fits(size)) return `A ${size} mm hoop doesn't fit on this ${def.label.toLowerCase()}`;
    if (!session.fitsHoop(size)) return `Your stitches don't fit in a ${size} mm hoop`;
    return '';
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|svg\+xml)$/.test(f.type)) {
      setError('Use a PNG, JPEG or SVG image.');
      return;
    }
    try {
      setError('');
      const im = await loadImageFile(f);
      useDesign.getState().begin();
      useDesign.getState().set({ image: { ...im, x: 0, y: 0, widthMm: hoopSize * 0.7, rotationDeg: 0 } });
      set({ tool: 'image' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read as an image.');
    }
  };

  // One piece at a time: once it has stitches, the product is fixed. Another product = a new piece.
  const pickProduct = async (id: ProductId) => {
    if (id === product) return;
    if (!stitched) return set({ product: id, tool: 'move' });
    const next = products[id].label.toLowerCase();
    const ok = unsaved
      ? await okToLeaveCurrent(`A new piece on the ${next}`)
      : await askConfirm({
          title: `Start a new piece on the ${next}?`,
          body: `“${pieceName}” is saved in Your pieces. You can open it from there any time.`,
          confirm: 'Start new piece',
        });
    if (ok) await newPiece(id);
  };

  const startOver = async () => {
    if (!(await okToLeaveCurrent('A new piece'))) return;
    await newPiece();
  };

  // Drop an image anywhere on the product screen.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      void onFile(e.dataTransfer?.files[0]);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  });

  // ⌘Z / Ctrl+Z undoes the design on this screen.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'z' &&
        !(e.target as HTMLElement).closest('input')
      ) {
        useDesign.getState().undo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <aside className="hoop-panel" aria-label="Set up your piece">
      {(stitched || hasDesign || pieceId) && (
        <div className="piece-line">
          <span className="piece-name">{pieceName ?? 'New piece'}</span>
          <span className="muted">
            {pieceId ? (unsaved ? 'Unsaved changes' : 'Saved') : stitched ? 'Not saved yet' : ''}
          </span>
          <button className="link" onClick={() => void startOver()}>
            New piece
          </button>
        </div>
      )}
      {modelError && modelError.product === product && (
        <p className="error" role="alert">
          The {def.label.toLowerCase()} model couldn't load. Try another product or reload.
        </p>
      )}
      <section>
        <h2>Product</h2>
        <div className="seg" role="radiogroup" aria-label="Product">
          {productIds.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={product === id}
              title={stitched && product !== id ? 'Starts a new piece' : undefined}
              onClick={() => void pickProduct(id)}
            >
              {products[id].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Colour</h2>
        <div className="swatches" role="radiogroup" aria-label={`${def.label} colour`}>
          {def.swatches.map((sw) => {
            const on = hslToHex(sw.color) === hslToHex(colors[product]);
            return (
              <button
                key={sw.name}
                role="radio"
                aria-checked={on}
                aria-label={sw.name}
                title={sw.name}
                style={{ background: hslToHex(sw.color) }}
                onClick={() => set({ colors: { ...colors, [product]: sw.color } })}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2>Hoop</h2>
        <div className="seg" role="radiogroup" aria-label="Hoop size">
          {hoopSizes.map((size) => {
            const why = sizeState(size);
            return (
              <button
                key={size}
                role="radio"
                aria-checked={hoopSize === size}
                disabled={!!why}
                title={why || `${size} mm hoop`}
                onClick={() => set({ hoopSize: size })}
              >
                {size} mm
              </button>
            );
          })}
        </div>
        <div className="chips" aria-label="Where on the product">
          {def.presets.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                set({ placement: { ...placement, [product]: { ...p.placement } }, tool: 'move' })
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Design</h2>
        <div className="seg four" role="radiogroup" aria-label="Design tool">
          {tools.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tool === t.id}
              title={t.hint}
              disabled={t.id === 'image' && !image}
              onClick={() => set({ tool: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(tool === 'pen' || tool === 'eraser') && (
          <label className="row">
            <span>Size</span>
            <input
              type="range"
              min={0.4}
              max={6}
              step={0.1}
              value={penWidth}
              onChange={(e) => set({ penWidthMm: Number(e.target.value) })}
            />
            <output>{(penWidth * (tool === 'eraser' ? 3 : 1)).toFixed(1)} mm</output>
          </label>
        )}
        {image && tool === 'image' && (
          <>
            <label className="row">
              <span>Width</span>
              <input
                type="range"
                min={5}
                max={hoopSize * 1.5}
                step={1}
                value={image.widthMm}
                onPointerDown={() => useDesign.getState().begin()}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  useDesign.getState().set({ image: { ...image, widthMm: Number(e.target.value) } })
                }
              />
              <output>{Math.round(image.widthMm)} mm</output>
            </label>
            <label className="row">
              <span>Turn</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={image.rotationDeg}
                onPointerDown={() => useDesign.getState().begin()}
                onChange={(e) =>
                  useDesign.getState().set({ image: { ...image, rotationDeg: Number(e.target.value) } })
                }
              />
              <output>{image.rotationDeg}°</output>
            </label>
          </>
        )}
        <div className="row buttons">
          <button className="ghost" onClick={() => file.current?.click()}>
            Upload image…
          </button>
          <button className="ghost" disabled={!canUndo} onClick={() => useDesign.getState().undo()}>
            Undo
          </button>
          <button className="ghost" disabled={!hasDesign} onClick={() => useDesign.getState().clear()}>
            Clear
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="note">
          The design is a guide you stitch over, like a washable transfer pen. Anything outside the hoop is
          cut off.
        </p>
      </section>

      <button className="primary" onClick={() => void startStitching()}>
        {stitched ? 'Continue stitching' : 'Start stitching'}
      </button>
      <button className="link how" onClick={() => useUi.getState().setOnboarding(true)}>
        How it works
      </button>

      <Shelf />
    </aside>
  );
}

export function Credit() {
  const product = useApp((s) => s.product);
  const c = products[product].credit;
  if (!c) return null;
  return (
    <p className="hoop-credit">
      <a href={c.url} target="_blank" rel="noreferrer">
        {c.text}
      </a>
      ,{' '}
      <a href={c.license.url} target="_blank" rel="noreferrer">
        {c.license.text}
      </a>
    </p>
  );
}

/** Re-render when stitches change (session.pieceHasStitches isn't reactive on its own). */
function useSessionPunctures(): number {
  return useSession((s) => s.punctures);
}
