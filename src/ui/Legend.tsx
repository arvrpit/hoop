// Collapsible legend (bottom left): what every interaction does, for this machine and the current
// tool. Open on the first visit (it doubles as the first-run hint) and folds away after the first stitch.
import { isMac } from '../interaction/projection';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { ChevronIcon } from './icons';

const K = ({ children }: { children: string }) => <kbd>{children}</kbd>;

export function Legend() {
  const open = useUi((s) => s.legendOpen);
  const seen = useUi((s) => s.legendSeen);
  const setLegend = useUi((s) => s.setLegend);
  const tool = useSession((s) => s.tool);
  const punctures = useSession((s) => s.punctures);
  const mac = isMac();
  const mod = mac ? '⌘' : 'Ctrl';
  return (
    <div className="hoop-legend" data-open={open}>
      <button aria-expanded={open} aria-controls="hoop-legend-body" onClick={() => setLegend(!open)}>
        Controls
        <span className="mode">{tool === 'view' ? 'Viewing' : 'Stitching'}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="body" id="hoop-legend-body">
          {!seen && punctures === 0 && (
            <p className="hint">
              Pick a stitch below · Click a hole to put the needle through · Zoom in to see the weave.
            </p>
          )}
          <section data-current={tool === 'view'}>
            <h3>Moving around</h3>
            <dl>
              <dt>
                {mac ? (
                  'Two-finger swipe'
                ) : (
                  <>
                    <K>Space</K> + drag
                  </>
                )}
              </dt>
              <dd>Move around{mac ? '' : ' (or drag with the View tool)'}</dd>
              <dt>
                {mac ? (
                  <>
                    Pinch or <K>⌘</K> + scroll
                  </>
                ) : (
                  'Scroll'
                )}
              </dt>
              <dd>Zoom</dd>
              <dt>
                <K>+</K> <K>−</K>
              </dt>
              <dd>Zoom in / out</dd>
              <dt>
                <K>⇧1</K>
              </dt>
              <dd>Fit the whole hoop</dd>
              <dt>
                <K>H</K> or <K>Esc</K>
              </dt>
              <dd>View tool (no holes)</dd>
            </dl>
          </section>
          <section data-current={tool === 'stitch'}>
            <h3>Stitching</h3>
            <dl>
              <dt>
                <K>R</K> <K>B</K> <K>S</K> <K>K</K>
              </dt>
              <dd>Running, back, satin, French knot</dd>
              <dt>Click a hole</dt>
              <dd>Put the needle through</dd>
              <dt>Arrows on the crosshair</dt>
              <dd>Pointing in: the needle goes down. Pointing out: it comes up.</dd>
              <dt>
                <K>T</K> or double-click
              </dt>
              <dd>Tie off this thread</dd>
              <dt>
                <K>1</K> … <K>9</K>
              </dt>
              <dd>Pick up a thread (carries on its line). Hover the left edge to see them all.</dd>
              <dt>
                <K>{mac ? '⌥' : 'Alt'}</K> + click, or hold
              </dt>
              <dd>Pick up the thread of the stitch you point at</dd>
              <dt>
                <K>{`${mod}Z`}</K> / <K>{mac ? '⇧⌘Z' : 'Ctrl⇧Z'}</K>
              </dt>
              <dd>Unpick / redo</dd>
              <dt>
                <K>?</K>
              </dt>
              <dd>Show or hide these controls</dd>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
