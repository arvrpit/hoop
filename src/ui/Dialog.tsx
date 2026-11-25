// The in-app confirm dialog (see askConfirm in state/ui.ts). Esc or the backdrop cancels; while it
// is open the hoop view's keyboard shortcuts are off (the controller checks for [data-modal]).
import { useEffect, useRef } from 'react';
import { useUi } from '../state/ui';

export function ConfirmDialog() {
  const c = useUi((s) => s.confirm);
  const ok = useRef<HTMLButtonElement>(null);
  const before = useRef<Element | null>(null);
  useEffect(() => {
    if (!c) return;
    before.current = document.activeElement;
    ok.current?.focus();
    return () => (before.current as HTMLElement | null)?.focus?.();
  }, [c]);
  if (!c) return null;
  const close = (v: boolean) => useUi.getState().closeConfirm(v);
  return (
    <div
      className="hoop-dialog-backdrop"
      data-modal
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div
        className="hoop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoop-dialog-title"
        aria-describedby="hoop-dialog-body"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') close(false);
        }}
      >
        <h2 id="hoop-dialog-title">{c.title}</h2>
        <p id="hoop-dialog-body">{c.body}</p>
        <div className="actions">
          <button className="ghost" onClick={() => close(false)}>
            {c.cancel ?? 'Cancel'}
          </button>
          <button ref={ok} className={c.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {c.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
