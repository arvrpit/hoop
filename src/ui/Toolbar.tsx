// Bottom toolbar (FigJam-style): View tool, the four stitch tools, the thread on the needle,
// undo / redo / tie off. Hovering (or focusing) a stitch tool opens a card with a cross-section of
// what that stitch does. The thread swatch opens the thread picker for the thread on the needle.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isMac } from '../interaction/projection';
import { hslToHex } from '../model/color';
import type { StitchType } from '../model/types';
import { session, useSession } from '../state/session';
import { useHoop } from '../state/store';
import { useUi } from '../state/ui';
import { tuning } from '../tuning';
import { StitchDiagram } from './StitchDiagram';
import { stitchGuides } from './stitchGuide';
import {
  BackIcon,
  HandIcon,
  KnotIcon,
  RedoIcon,
  RunningIcon,
  SatinIcon,
  TieOffIcon,
  UndoIcon,
} from './icons';

const tools: { type: StitchType; label: string; key: string; Icon: () => React.JSX.Element }[] = [
  { type: 'running', label: 'Running stitch', key: 'R', Icon: RunningIcon },
  { type: 'back', label: 'Back stitch', key: 'B', Icon: BackIcon },
  { type: 'satin', label: 'Satin stitch', key: 'S', Icon: SatinIcon },
  { type: 'knot', label: 'French knot', key: 'K', Icon: KnotIcon },
];

export function Toolbar() {
  const tool = useSession((s) => s.tool);
  const stitchType = useSession((s) => s.stitchType);
  const thread = useSession((s) => s.thread);
  const canUndo = useSession((s) => s.canUndo);
  const canRedo = useSession((s) => s.canRedo);
  const mod = isMac() ? '⌘' : 'Ctrl+';
  const card = useStitchCard();
  return (
    <div className="hoop-toolbar" role="toolbar" aria-label="Tools">
      <button
        className="hoop-tool"
        aria-pressed={tool === 'view'}
        aria-label="View: move around"
        aria-keyshortcuts="H"
        data-tip="View · H"
        onClick={() => session.setTool('view')}
      >
        <HandIcon />
      </button>
      <span className="sep" />
      {tools.map(({ type, label, key, Icon }) => (
        <button
          key={type}
          className="hoop-tool"
          aria-pressed={tool === 'stitch' && stitchType === type}
          aria-label={label}
          aria-keyshortcuts={key}
          aria-describedby={card.open?.type === type ? 'hoop-stitch-card' : undefined}
          onClick={() => session.chooseStitch(type)}
          {...card.handlers(type)}
        >
          <Icon />
        </button>
      ))}
      <span className="sep" />
      <button
        className="hoop-tool"
        aria-label={thread ? `Edit thread: ${thread.name}` : 'Add a thread'}
        data-tip={
          thread
            ? `${thread.name} · ${thread.material}, ${thread.strands} strands · click to edit`
            : 'Add a thread'
        }
        onClick={() =>
          useUi.getState().openPicker(thread ? { mode: 'edit', threadId: thread.id } : { mode: 'add' })
        }
      >
        <span
          className="hoop-swatch"
          style={{ background: thread ? hslToHex(thread.color) : 'transparent' }}
        />
      </button>
      <span className="sep" />
      <button
        className="hoop-tool"
        aria-label="Undo (unpick)"
        aria-keyshortcuts={isMac() ? 'Meta+Z' : 'Control+Z'}
        data-tip={`Undo · ${mod}Z`}
        disabled={!canUndo}
        onClick={() => session.undo()}
      >
        <UndoIcon />
      </button>
      <button
        className="hoop-tool"
        aria-label="Redo"
        aria-keyshortcuts={isMac() ? 'Shift+Meta+Z' : 'Shift+Control+Z'}
        data-tip={`Redo · ${isMac() ? '⇧⌘' : 'Ctrl+Shift+'}Z`}
        disabled={!canRedo}
        onClick={() => session.redo()}
      >
        <RedoIcon />
      </button>
      {card.open && <StitchCard type={card.open.type} anchor={card.open.rect} />}
      <button
        className="hoop-tool"
        aria-label="Tie off"
        aria-keyshortcuts="T"
        data-tip="Tie off · T or double-click"
        onClick={() => session.tieOff()}
      >
        <TieOffIcon />
      </button>
    </div>
  );
}

/** Open the diagram card after a short hover, or at once on keyboard focus; close on leave/blur. */
function useStitchCard() {
  const [open, setOpen] = useState<{ type: StitchType; rect: DOMRect } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (type: StitchType, el: HTMLElement, delay: number) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen({ type, rect: el.getBoundingClientRect() }), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(null);
  };
  return {
    open,
    handlers: (type: StitchType) => ({
      onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' || e.pointerType === 'pen')
          show(type, e.currentTarget, tuning.stitchDiagramDelayMs);
      },
      onPointerLeave: hide,
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        if (e.currentTarget.matches(':focus-visible')) show(type, e.currentTarget, 0);
      },
      onBlur: hide,
    }),
  };
}

function StitchCard({ type, anchor }: { type: StitchType; anchor: DOMRect }) {
  const g = stitchGuides[type];
  const setting = useHoop((s) => s.reducedMotion);
  const reduce =
    setting === 'on' ||
    (setting === 'system' &&
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches);
  const width = 272;
  const left = Math.min(
    Math.max(8, anchor.left + anchor.width / 2 - width / 2),
    window.innerWidth - width - 8,
  );
  // Rendered on <body>: the toolbar's centring transform would otherwise anchor this fixed card to it.
  return createPortal(
    <div
      id="hoop-stitch-card"
      className="hoop-stitch-card"
      role="tooltip"
      style={{ left, bottom: window.innerHeight - anchor.top + 12, width }}
    >
      <div className="head">
        <strong>{g.label}</strong>
        <kbd>{g.key}</kbd>
      </div>
      <StitchDiagram type={type} animate={!reduce} />
      <p>{g.description}</p>
    </div>,
    document.body,
  );
}
