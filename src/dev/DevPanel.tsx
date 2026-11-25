// Leva tuning panel (dev only). Starts from the values in tuning.ts; "Copy tuning values" puts the
// current thread-material numbers on the clipboard so they can be pasted back into tuning.ts.
import { button, folder, Leva, useControls } from 'leva';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { FabricId, ThreadMaterial } from '../model/types';
import { useHoop, type PieceSource } from '../state/store';
import { threadMaterials, type ThreadMaterialParams } from '../tuning';

type OnChangeCtx = { initial: boolean };
const set = (patch: Parameters<ReturnType<typeof useHoop.getState>['set']>[0]) =>
  useHoop.getState().set(patch);

function materialFolder(m: ThreadMaterial) {
  const p = threadMaterials[m];
  const edit = (key: keyof ThreadMaterialParams) => (v: number, _path: string, ctx: OnChangeCtx) => {
    if (ctx.initial) return;
    const mats = useHoop.getState().materials;
    set({ materials: { ...mats, [m]: { ...mats[m], [key]: v } } });
  };
  return folder(
    {
      [`${m} plies`]: { value: p.plies, min: 1, max: 8, step: 1, onChange: edit('plies') },
      [`${m} twist/mm`]: { value: p.twistPerMm, min: 0, max: 3, step: 0.05, onChange: edit('twistPerMm') },
      [`${m} twist slope`]: { value: p.twistSlope, min: 0, max: 5, step: 0.05, onChange: edit('twistSlope') },
      [`${m} ply depth`]: { value: p.plyDepth, min: 0, max: 1.5, step: 0.05, onChange: edit('plyDepth') },
      [`${m} sheen`]: { value: p.sheen, min: 0, max: 2, step: 0.05, onChange: edit('sheen') },
      [`${m} spec exp`]: { value: p.specExponent, min: 2, max: 300, step: 1, onChange: edit('specExponent') },
      [`${m} fuzz`]: { value: p.fuzz, min: 0, max: 1, step: 0.01, onChange: edit('fuzz') },
      [`${m} fibre`]: { value: p.fibre, min: 0, max: 2, step: 0.05, onChange: edit('fibre') },
      [`${m} flatten`]: { value: p.flatten, min: 0, max: 1, step: 0.05, onChange: edit('flatten') },
      [`${m} strand split`]: {
        value: p.strandSplit,
        min: 0,
        max: 1,
        step: 0.05,
        onChange: edit('strandSplit'),
      },
      [`${m} mm/strand`]: {
        value: p.widthPerStrandMm,
        min: 0.1,
        max: 1,
        step: 0.01,
        onChange: edit('widthPerStrandMm'),
      },
    },
    { collapsed: true },
  );
}

export function DevPanel({ hidden }: { hidden: boolean }) {
  const s0 = useHoop.getState();
  useControls(() => ({
    View: folder({
      fabric: {
        value: s0.fabric,
        options: {
          Cotton: 'cotton',
          Linen: 'linen',
          'Aida 14': 'aida14',
          'Wool felt': 'felt',
          Jersey: 'jersey',
          Canvas: 'canvas',
        },
        onChange: (v: FabricId, _p: string, ctx: OnChangeCtx) => !ctx.initial && set({ fabric: v }),
      },
      piece: {
        value: s0.source,
        options: {
          'Product piece': 'product',
          'Blank hoop': 'blank',
          'Demo piece': 'demo',
          'Stress: 20k stitches': 'stress',
        },
        onChange: (v: PieceSource, _p: string, c: OnChangeCtx) =>
          !c.initial && set({ source: v, alwaysRender: v === 'stress' }),
      },
      '1×': button(() => set({ zoom: 1, focus: { x: 0, y: 0 } })),
      '3×': button(() => set({ zoom: 3 })),
      '8×': button(() => set({ zoom: 8 })),
      shadows: {
        value: s0.shadows,
        onChange: (v: boolean, _p: string, c: OnChangeCtx) => !c.initial && set({ shadows: v }),
      },
      'reduced motion': {
        value: s0.reducedMotion,
        options: { 'Follow system': 'system', On: 'on', Off: 'off' },
        onChange: (v: 'system' | 'on' | 'off', _p: string, c: OnChangeCtx) =>
          !c.initial && set({ reducedMotion: v }),
      },
      'render every frame': {
        value: s0.alwaysRender,
        onChange: (v: boolean, _p: string, c: OnChangeCtx) => !c.initial && set({ alwaysRender: v }),
      },
    }),
    'Key light': folder({
      azimuth: {
        value: s0.keyAzimuthDeg,
        min: 0,
        max: 360,
        step: 1,
        onChange: (v: number, _p: string, c: OnChangeCtx) => !c.initial && set({ keyAzimuthDeg: v }),
      },
      elevation: {
        value: s0.keyElevationDeg,
        min: 5,
        max: 90,
        step: 1,
        onChange: (v: number, _p: string, c: OnChangeCtx) => !c.initial && set({ keyElevationDeg: v }),
      },
      'key intensity': {
        value: s0.keyIntensity,
        min: 0,
        max: 3,
        step: 0.05,
        onChange: (v: number, _p: string, c: OnChangeCtx) => !c.initial && set({ keyIntensity: v }),
      },
      ambient: {
        value: s0.ambientIntensity,
        min: 0,
        max: 1.5,
        step: 0.05,
        onChange: (v: number, _p: string, c: OnChangeCtx) => !c.initial && set({ ambientIntensity: v }),
      },
    }),
    Lamp: folder({
      'follows camera': {
        value: s0.lampFollowsCamera,
        onChange: (v: boolean, _p: string, c: OnChangeCtx) => !c.initial && set({ lampFollowsCamera: v }),
      },
      'lamp x': {
        value: s0.lampPos.x,
        min: -80,
        max: 80,
        step: 0.5,
        onChange: (v: number, _p: string, c: OnChangeCtx) =>
          !c.initial && set({ lampFollowsCamera: false, lampPos: { ...useHoop.getState().lampPos, x: v } }),
      },
      'lamp y': {
        value: s0.lampPos.y,
        min: -80,
        max: 80,
        step: 0.5,
        onChange: (v: number, _p: string, c: OnChangeCtx) =>
          !c.initial && set({ lampFollowsCamera: false, lampPos: { ...useHoop.getState().lampPos, y: v } }),
      },
      height: {
        value: s0.lampHeightMm,
        min: 20,
        max: 400,
        step: 1,
        onChange: (v: number, _p: string, c: OnChangeCtx) => !c.initial && set({ lampHeightMm: v }),
      },
      'lamp intensity': {
        value: s0.lampIntensity,
        min: 0,
        max: 2,
        step: 0.02,
        onChange: (v: number, _p: string, c: OnChangeCtx) => !c.initial && set({ lampIntensity: v }),
      },
      'radius (0 = auto)': {
        value: 0,
        min: 0,
        max: 200,
        step: 1,
        onChange: (v: number, _p: string, c: OnChangeCtx) =>
          !c.initial && set({ lampRadiusMm: v > 0 ? v : null }),
      },
    }),
    Threads: folder(
      {
        Floss: materialFolder('floss'),
        Perle: materialFolder('perle'),
        Silk: materialFolder('silk'),
        Wool: materialFolder('wool'),
        'Copy tuning values': button(() => {
          const text = JSON.stringify(useHoop.getState().materials, null, 2);
          console.log(text);
          void navigator.clipboard?.writeText(text).catch(() => undefined);
        }),
      },
      { collapsed: true },
    ),
  }));

  return <ResizablePanel hidden={hidden} />;
}

const MIN_W = 280;
const MAX_W = 720;
const WIDTH_KEY = 'hoop.lookPanelWidth';

function readWidth(): number {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(v) && v >= MIN_W && v <= MAX_W ? v : 380;
  } catch {
    return 380;
  }
}

/** The leva panel in a container whose left edge can be dragged to make it wider or narrower. */
function ResizablePanel({ hidden }: { hidden: boolean }) {
  const [width, setWidth] = useState(readWidth);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const apply = (w: number) => {
    const next = Math.round(Math.min(MAX_W, Math.max(MIN_W, w)));
    setWidth(next);
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      /* storage unavailable: width just isn't remembered */
    }
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: width };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) apply(drag.current.w + (drag.current.x - e.clientX));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') apply(width + 20);
    else if (e.key === 'ArrowRight') apply(width - 20);
    else return;
    e.preventDefault();
  };
  if (hidden) return <Leva hidden />;
  return (
    <div
      data-look-panel
      style={{
        position: 'fixed',
        top: 64, // below the Save & render / Download image button
        right: 10,
        width,
        maxHeight: 'calc(100% - 20px)',
        overflowY: 'auto',
        borderRadius: 10,
        zIndex: 1000,
      }}
    >
      <Leva
        fill
        collapsed={!import.meta.env.DEV}
        titleBar={{ title: 'Hoop · look test', drag: false }}
        theme={{ sizes: { controlWidth: `${Math.round(Math.max(150, width * 0.45))}px` } }}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel (drag, or use the left and right arrow keys)"
        aria-valuemin={MIN_W}
        aria-valuemax={MAX_W}
        aria-valuenow={width}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => apply(380)}
        onKeyDown={onKey}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'ew-resize',
          touchAction: 'none',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span
          aria-hidden
          style={{ width: 3, height: 32, borderRadius: 2, background: 'rgba(255,255,255,0.28)' }}
        />
      </div>
    </div>
  );
}
