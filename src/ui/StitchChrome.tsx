// Hoop-view extras: back to the product, the traced design's visibility, Save & render (top
// right), and the zoom control.
import { products } from '../model/products';
import { useApp } from '../state/app';
import { useDesign } from '../state/design';
import { backToProduct, finishAndSave } from '../state/flow';
import { useSession } from '../state/session';
import { askConfirm } from '../state/ui';
import { useHoop } from '../state/store';
import { zoomHooks } from '../interaction/controller';

export function StitchChrome() {
  const product = useApp((s) => s.product);
  const visible = useDesign((s) => s.visible);
  const opacity = useDesign((s) => s.opacity);
  const hasDesign = useDesign((s) => s.strokes.length > 0 || s.image !== null);
  return (
    <div className="hoop-chrome">
      <button className="back" onClick={() => void backToProduct()}>
        <span aria-hidden>←</span> {products[product].label}
      </button>
      {hasDesign && (
        <div className="guide">
          <label>
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => useDesign.getState().set({ visible: e.target.checked })}
            />
            Design guide
          </label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            disabled={!visible}
            aria-label="Design guide strength"
            onChange={(e) => useDesign.getState().set({ opacity: Number(e.target.value) })}
          />
        </div>
      )}
    </div>
  );
}

export function ZoomControl() {
  const zoom = useHoop((s) => s.zoom);
  return (
    <div className="hoop-zoom" role="group" aria-label="Zoom">
      <button aria-label="Zoom out" title="Zoom out · −" onClick={() => zoomHooks.zoomBy(1 / 1.25)}>
        −
      </button>
      <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
      <button aria-label="Zoom in" title="Zoom in · +" onClick={() => zoomHooks.zoomBy(1.25)}>
        +
      </button>
      <button className="fit" title="Fit hoop · Shift+1" onClick={() => zoomHooks.fit()}>
        Fit
      </button>
    </div>
  );
}

/** Top right of the hoop view: finish the piece, see it on the product, and save it. */
export function SaveButton() {
  const source = useHoop((s) => s.source);
  const punctures = useSession((s) => s.punctures);
  const label = useApp((s) => products[s.product].label.toLowerCase());
  if (source !== 'product') return null;
  const finish = async () => {
    const ok = await askConfirm({
      title: 'Finished stitching?',
      body: `The hoop comes off and the design guide washes out, so you see the finished ${label}. It's saved to Your pieces, and you can reopen it to keep stitching.`,
      confirm: 'Save & render',
      cancel: 'Keep stitching',
    });
    if (ok) await finishAndSave();
  };
  return (
    <button
      className="hoop-action primary"
      disabled={punctures === 0}
      title={punctures === 0 ? 'Stitch something first' : 'Finish this piece and save it'}
      onClick={() => void finish()}
    >
      Save &amp; render
    </button>
  );
}
