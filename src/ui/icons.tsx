// Simple line icons for the toolbar (24×24, drawn with currentColor).
const s = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const HandIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5M14 10.5V6.5a1.5 1.5 0 0 1 3 0v6M17 11.5V9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4 15.2a1.6 1.6 0 0 1 2.5-2L8 15" />
  </svg>
);
export const RunningIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M3 20l4.2-4.2M10 13l4-4M16.8 6.2L21 2" />
  </svg>
);
export const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M3 19l5-5 5 2 7-9" />
    <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="13" cy="16" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const SatinIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M4 20l6-16M8 20l6-16M12 20l6-16M16 20l4-10.7" />
  </svg>
);
export const KnotIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <circle cx="12" cy="12" r="6.5" />
    <path d="M12 8.5a3.5 3.5 0 1 1-3.5 3.5" />
  </svg>
);
export const UndoIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
export const RedoIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
);
export const TieOffIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M3 12h5.5M15.5 12H21" />
    <circle cx="12" cy="12" r="3.5" />
  </svg>
);
export const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden {...s}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);
