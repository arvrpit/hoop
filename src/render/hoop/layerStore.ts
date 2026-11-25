// One stitch layer for the whole app: it follows the session even while the product screen is
// showing, so the stitches can be baked onto the product without rebuilding anything.
import { session } from '../../state/session';
import { render } from '../../state/render';
import { useHoop } from '../../state/store';
import { StitchLayer } from './stitchLayer';

function reducedMotion(): boolean {
  const pref = useHoop.getState().reducedMotion;
  if (pref !== 'system') return pref === 'on';
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const stitchLayer = new StitchLayer();

function rebuild(): void {
  stitchLayer.rebuild(session.renderData(), useHoop.getState().materials, (p) => session.holeKey(p));
  render.invalidate();
}
rebuild();

session.onEvent((e) => {
  if (e.kind === 'rebuild') return rebuild();
  if (e.kind === 'previewThreads') {
    stitchLayer.setThreads(e.threads ?? session.engine.piece.threads, useHoop.getState().materials);
    return render.invalidate();
  }
  stitchLayer.apply(
    e.change,
    session.engine.piece.threads,
    useHoop.getState().materials,
    (p) => session.holeUseCount(p),
    performance.now(),
    !reducedMotion(),
  );
  render.invalidate();
});

useHoop.subscribe((s, prev) => {
  if (s.materials !== prev.materials) stitchLayer.setThreads(session.renderData().threads, s.materials);
});
