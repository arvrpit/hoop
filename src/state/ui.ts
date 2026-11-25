// Small interface state shared by the controls: the onboarding steps and the legend (both
// remembered per browser), the confirm dialog, the thread picker and short toasts.
import { create } from 'zustand';
import { tuning } from '../tuning';

const KEY = 'hoop.legend';
const ONBOARDING_KEY = 'hoop.onboarding';

/** First visit (or storage unavailable): show the "how it works" steps. */
function onboardingSeen(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'seen';
  } catch {
    return false;
  }
}

function read(): { open: boolean; seen: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { open?: boolean; seen?: boolean } | null;
    if (v && typeof v.open === 'boolean') return { open: v.open, seen: !!v.seen };
  } catch {
    /* storage unavailable */
  }
  return { open: true, seen: false }; // first visit: open, it doubles as the first-run hint
}

export interface ConfirmOptions {
  title: string;
  body: string;
  confirm: string;
  cancel?: string;
  danger?: boolean; // the confirm button discards or deletes something
}

/** The thread picker: adding a new thread, or editing one (optionally straight to its name). */
export type PickerState = { mode: 'add' } | { mode: 'edit'; threadId: string; focus?: 'name' };

interface UiState {
  onboarding: boolean; // the "how it works" steps are open
  setOnboarding: (open: boolean) => void;
  picker: PickerState | null;
  openPicker: (p: PickerState) => void;
  closePicker: () => void;
  toast: { text: string; id: number } | null;
  showToast: (text: string) => void;
  confirm: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  closeConfirm: (ok: boolean) => void;
  legendOpen: boolean;
  legendSeen: boolean; // collapsed itself after the first stitch; never auto-opens again
  setLegend: (open: boolean) => void;
  markSeen: () => void;
}

export const useUi = create<UiState>((set, get) => {
  const init = read();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ open: get().legendOpen, seen: get().legendSeen }));
    } catch {
      /* storage unavailable */
    }
  };
  let toastTimer = 0;
  return {
    onboarding: !onboardingSeen(),
    setOnboarding: (open) => {
      set({ onboarding: open });
      if (open) return;
      try {
        localStorage.setItem(ONBOARDING_KEY, 'seen');
      } catch {
        /* storage unavailable: it shows again next visit */
      }
    },
    picker: null,
    openPicker: (picker) => set({ picker }),
    closePicker: () => set({ picker: null }),
    toast: null,
    showToast: (text) => {
      clearTimeout(toastTimer);
      set({ toast: { text, id: (get().toast?.id ?? 0) + 1 } });
      toastTimer = window.setTimeout(() => set({ toast: null }), tuning.toastMs);
    },
    confirm: null,
    closeConfirm: (ok) => {
      get().confirm?.resolve(ok);
      set({ confirm: null });
    },
    legendOpen: init.open,
    legendSeen: init.seen,
    setLegend: (open) => {
      set({ legendOpen: open });
      save();
    },
    markSeen: () => {
      if (get().legendSeen) return;
      set({ legendSeen: true, legendOpen: false });
      save();
    },
  };
});

/** Ask a yes/no question in a small in-app dialog. */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  useUi.getState().confirm?.resolve(false);
  return new Promise((resolve) => useUi.setState({ confirm: { ...opts, resolve } }));
}
