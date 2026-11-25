// The thread rack (spec 8.1): one skein per thread, in a drawer tucked off the left edge. Only the
// thread on the needle peeks out; hovering the left edge (or tabbing in, or tapping the peeking
// skein) slides the drawer out. The thread on the needle always sits a little out of line.
// Click a skein (or press 1–9) to put it on the needle; if it has an unfinished line, stitching
// picks up from its last hole. ⋯ (or right-click) edits, renames or removes a thread; + adds one.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { threadMaterials, tuning } from '../tuning';
import type { Thread } from '../model/types';
import { session, useSession } from '../state/session';
import { askConfirm, useUi } from '../state/ui';
import { useHoop } from '../state/store';
import { Skein } from './Skein';

export function ThreadRack() {
  const threads = useSession((s) => s.threads);
  const activeId = useSession((s) => s.thread?.id ?? null);
  const openIds = useSession((s) => s.openThreadIds);
  const pickerOpen = useUi((s) => s.picker !== null);
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const drawer = useDrawer(!!menu || pickerOpen);
  const items = useRef(new Map<string, HTMLElement>());
  useRethreadGlint(activeId, items.current);

  const showTip = (el: HTMLElement, text: string) => {
    const r = el.getBoundingClientRect();
    setTip({ text, x: r.right + 12, y: r.top + r.height / 2 });
  };

  return (
    <div className="hoop-rack" data-open={drawer.open || undefined} ref={drawer.ref} {...drawer.handlers}>
      <div className="edge" aria-hidden />
      <div className="panel" role="toolbar" aria-label="Threads" aria-orientation="vertical">
        <ul>
          {threads.map((t, i) => {
            const active = t.id === activeId;
            const mat = threadMaterials[t.material].label;
            const text = `${t.name} · ${mat}, ${t.strands} ${t.strands === 1 ? 'strand' : 'strands'}${openIds.includes(t.id) ? ' · line in progress' : ''}`;
            return (
              <li
                key={t.id}
                data-active={active || undefined}
                ref={(el) => {
                  if (el) items.current.set(t.id, el);
                  else items.current.delete(t.id);
                }}
              >
                <div className="item">
                  <button
                    className="spool"
                    aria-pressed={active}
                    aria-label={`${t.name}${i < 9 ? ` (${i + 1})` : ''}`}
                    aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                    onClick={() => session.pickThread(t.id)}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && showTip(e.currentTarget, text)}
                    onPointerLeave={() => setTip(null)}
                    onFocus={(e) =>
                      e.currentTarget.matches(':focus-visible') && showTip(e.currentTarget, text)
                    }
                    onBlur={() => setTip(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setTip(null);
                      setMenu({ id: t.id, rect: e.currentTarget.getBoundingClientRect() });
                    }}
                  >
                    <Skein thread={t} />
                    {i < 9 && <span className="badge">{i + 1}</span>}
                    {openIds.includes(t.id) && <span className="open" aria-hidden />}
                  </button>
                  <button
                    className="more"
                    aria-label={`More for ${t.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menu?.id === t.id}
                    onClick={(e) => {
                      setTip(null);
                      setMenu(
                        menu?.id === t.id
                          ? null
                          : { id: t.id, rect: e.currentTarget.parentElement!.getBoundingClientRect() },
                      );
                    }}
                  >
                    <span aria-hidden>⋯</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          className="add"
          aria-label="Add a thread"
          onClick={() => useUi.getState().openPicker({ mode: 'add' })}
          onPointerEnter={(e) => e.pointerType === 'mouse' && showTip(e.currentTarget, 'Add a thread')}
          onPointerLeave={() => setTip(null)}
        >
          <span aria-hidden>+</span>
        </button>
      </div>
      {tip && drawer.open && (
        <div className="tip" style={{ left: tip.x, top: tip.y }} aria-hidden>
          {tip.text}
        </div>
      )}
      {menu && (
        <ThreadMenu
          thread={threads.find((t) => t.id === menu.id)}
          only={threads.length === 1}
          anchor={menu.rect}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

/**
 * Open while the mouse is over the left edge or the drawer, while a keyboard user is in it, after a
 * tap on the peeking skein (until a tap elsewhere), and while its menu or the thread picker is open.
 */
function useDrawer(held: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef(0);
  const swallow = useRef(false);
  const open = hover || keyboard || pinned || held;

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('[data-modal]'))
        setPinned(false);
    };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [pinned]);

  return {
    ref,
    open,
    handlers: {
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === 'touch') return;
        clearTimeout(timer.current);
        setHover(true);
      },
      // Also on move: right after a screen change the browser may not report the enter.
      onPointerMove: (e: React.PointerEvent) => {
        if (e.pointerType === 'touch' || hover) return;
        clearTimeout(timer.current);
        setHover(true);
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType === 'touch') return;
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setHover(false), tuning.rackCloseDelayMs);
      },
      // A tap on the closed drawer only opens it (no hover on touch screens).
      onPointerDownCapture: (e: React.PointerEvent) => {
        if (e.pointerType === 'touch' && !open) {
          setPinned(true);
          swallow.current = true;
        }
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (!swallow.current) return;
        swallow.current = false;
        e.stopPropagation();
        e.preventDefault();
      },
      onFocus: (e: React.FocusEvent) => {
        if ((e.target as HTMLElement).matches(':focus-visible')) setKeyboard(true);
      },
      onBlur: (e: React.FocusEvent) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setKeyboard(false);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') (document.activeElement as HTMLElement | null)?.blur();
      },
    },
  };
}

/** The skein that goes on the needle glints as it slides out (never blocks the next click). */
function useRethreadGlint(activeId: string | null, items: Map<string, HTMLElement>) {
  const prev = useRef(activeId);
  const reduce = useHoop((s) => s.reducedMotion);
  useEffect(() => {
    if (prev.current === activeId) return;
    const first = prev.current === null;
    prev.current = activeId;
    if (first || !activeId) return;
    const el = items.get(activeId)?.querySelector<HTMLElement>('.hoop-skein');
    if (!el || !el.animate) return;
    const system = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce === 'on' || (reduce === 'system' && system)) return;
    el.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.12)', filter: 'brightness(1.35)', offset: 0.35 },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: tuning.rethreadMs, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }, [activeId, items, reduce]);
}

function ThreadMenu({
  thread,
  only,
  anchor,
  onClose,
}: {
  thread: Thread | undefined;
  only: boolean;
  anchor: DOMRect;
  onClose: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(thread?.name ?? '');
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(anchor.top);

  useLayoutEffect(() => {
    const h = box.current?.offsetHeight ?? 0;
    setTop(Math.max(8, Math.min(anchor.top, window.innerHeight - h - 8)));
  }, [anchor, renaming]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    // Next tick, so the click that opened the menu doesn't close it.
    const id = setTimeout(() => window.addEventListener('pointerdown', away));
    box.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => {
      clearTimeout(id);
      window.removeEventListener('pointerdown', away);
    };
  }, [onClose, renaming]);

  if (!thread) return null;

  const remove = async () => {
    onClose();
    const n = session.stitchCountFor(thread.id);
    if (n > 0) {
      const ok = await askConfirm({
        title: `Remove ${thread.name}?`,
        body: `This will unpick ${n} ${n === 1 ? 'stitch' : 'stitches'} made with it. You can undo this.`,
        confirm: 'Remove and unpick',
        danger: true,
      });
      if (!ok) return;
    }
    session.removeThread(thread.id);
    useUi.getState().showToast(`Removed ${thread.name}`);
  };
  const saveName = () => {
    const v = name.trim();
    if (v && v !== thread.name) session.updateThread(thread.id, { name: v });
    onClose();
  };

  const style: CSSProperties = { left: anchor.right + 10, top };
  return createPortal(
    <div
      ref={box}
      className="hoop-menu"
      role={renaming ? 'dialog' : 'menu'}
      aria-label={renaming ? `Rename ${thread.name}` : `${thread.name} options`}
      data-modal
      style={style}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
        if (!renaming && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          const items = [
            ...(box.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
          ];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
          e.preventDefault();
        }
      }}
    >
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <input
            aria-label="Thread name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="primary">
            Save
          </button>
        </form>
      ) : (
        <>
          <button
            role="menuitem"
            onClick={() => {
              onClose();
              useUi.getState().openPicker({ mode: 'edit', threadId: thread.id });
            }}
          >
            Edit thread…
          </button>
          <button role="menuitem" onClick={() => setRenaming(true)}>
            Rename…
          </button>
          <button
            role="menuitem"
            className="danger"
            disabled={only}
            title={only ? 'Keep at least one thread' : undefined}
            onClick={() => void remove()}
          >
            Remove
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
