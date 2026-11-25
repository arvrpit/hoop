// The finished piece: out of the hoop, guide washed off, saved to Your pieces. Turn it, download an
// image, keep stitching (back into the hoop), or start a new piece.
import { products } from '../model/products';
import { useApp } from '../state/app';
import { downloadImage, newPiece, saveCurrent, startStitching } from '../state/flow';

export function FinishedPanel() {
  const product = useApp((s) => s.product);
  const name = useApp((s) => s.pieceName);
  const status = useApp((s) => s.saveStatus);
  const label = products[product].label.toLowerCase();
  return (
    <aside className="hoop-panel finished" aria-label="Finished piece">
      <section>
        <h2>Finished piece</h2>
        <p className="piece-name">{name ?? products[product].label}</p>
        <p className="note" role="status">
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && 'Saved to Your pieces.'}
          {status === 'failed' && (
            <>
              Couldn't save in this browser.{' '}
              <button className="link" onClick={() => void saveCurrent()}>
                Try again
              </button>
            </>
          )}
        </p>
      </section>
      <p className="note">The hoop is off and the design guide is washed out. Drag to turn the {label}.</p>
      <button className="primary" onClick={() => void startStitching()}>
        Keep stitching
      </button>
      <button className="ghost wide" onClick={() => void newPiece()}>
        New piece
      </button>
    </aside>
  );
}

export function DownloadButton() {
  return (
    <button className="hoop-action" onClick={() => void downloadImage()}>
      Download image
    </button>
  );
}
