// A short note above the toolbar ("Picked up Leaf green"), read out by screen readers.
import { useUi } from '../state/ui';

export function Toast() {
  const toast = useUi((s) => s.toast);
  return (
    <div className="hoop-toast" role="status" aria-live="polite">
      {toast && <span key={toast.id}>{toast.text}</span>}
    </div>
  );
}
