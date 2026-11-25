// "Your pieces": saved pieces in this browser. Open one to see it finished (and keep stitching from
// there); delete with a confirm.
import { products } from '../model/products';
import { useApp } from '../state/app';
import { okToLeaveCurrent, openSaved } from '../state/flow';
import { useShelf } from '../state/shelf';
import { askConfirm } from '../state/ui';

export function Shelf() {
  const items = useShelf((s) => s.items);
  const status = useShelf((s) => s.status);
  const current = useApp((s) => s.pieceId);

  const open = async (id: string, name: string) => {
    if (id !== current && !(await okToLeaveCurrent(`“${name}”`))) return;
    await openSaved(id);
  };
  const remove = async (id: string, name: string) => {
    const ok = await askConfirm({
      title: `Delete “${name}”?`,
      body: "It's removed from Your pieces in this browser. This can't be undone.",
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await useShelf.getState().remove(id);
    if (useApp.getState().pieceId === id)
      useApp.getState().set({ pieceId: null, pieceName: null, unsaved: true });
  };

  return (
    <section className="shelf" aria-label="Your pieces">
      <h2>Your pieces</h2>
      {status === 'unavailable' && (
        <p className="note">Saving isn't available in this browser window (private browsing can block it).</p>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="note">Pieces you finish with Save &amp; render appear here.</p>
      )}
      {items.length > 0 && (
        <ul>
          {items.map((it) => (
            <li key={it.id} data-current={it.id === current}>
              <button
                className="thumb"
                aria-label={`Open ${it.name}`}
                title={`Open ${it.name}`}
                onClick={() => void open(it.id, it.name)}
              >
                {it.thumbnail ? <img src={it.thumbnail} alt="" /> : <span>{products[it.product].label}</span>}
                <span className="name">{it.name}</span>
              </button>
              <button
                className="delete"
                aria-label={`Delete ${it.name}`}
                title="Delete"
                onClick={() => void remove(it.id, it.name)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
