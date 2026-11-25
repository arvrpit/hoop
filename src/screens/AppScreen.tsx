// The whole app in one WebGL canvas: the product screen (set up the hoop and design) and the hoop
// view (stitch). One canvas lets the stitches be baked straight onto the product.
import { Canvas, useThree } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { attachInteraction } from '../interaction/controller';
import { HoopScene } from '../render/hoop/HoopScene';
import { ProductScene } from '../render/product/ProductScene';
import { setSwatchRenderer } from '../render/swatch/swatches';
import { useApp } from '../state/app';
import { fader } from '../state/flow';
import { useHoop } from '../state/store';
import { IntentOverlay } from '../ui/intentOverlay';
import { Legend } from '../ui/Legend';
import { Credit, ProductPanel } from '../ui/ProductPanel';
import { ConfirmDialog } from '../ui/Dialog';
import { DownloadButton, FinishedPanel } from '../ui/FinishedPanel';
import { SaveButton, StitchChrome, ZoomControl } from '../ui/StitchChrome';
import { Toolbar } from '../ui/Toolbar';
import { ThreadRack } from '../ui/ThreadRack';
import { ThreadPicker } from '../ui/ThreadPicker';
import { Toast } from '../ui/Toast';
import { Onboarding } from '../ui/Onboarding';
import '../ui/ui.css';

const lookPanel = import.meta.env.DEV || import.meta.env.VITE_LOOK_PANEL === '1';
const DevTools = lookPanel ? lazy(() => import('../dev/DevTools')) : null;
const DevBench = import.meta.env.DEV ? lazy(() => import('../dev/DevBench')) : null;

export function AppScreen() {
  const wrap = useRef<HTMLDivElement>(null);
  const overlayHost = useRef<HTMLDivElement>(null);
  const fade = useRef<HTMLDivElement>(null);
  const screen = useApp((s) => s.screen);
  const hideUi = useHoop((s) => s.hideUi);
  const alwaysRender = useHoop((s) => s.alwaysRender);
  const source = useHoop((s) => s.source);

  useEffect(() => {
    fader.fade = (out) =>
      new Promise((resolve) => {
        const el = fade.current;
        if (!el) return resolve();
        const reduce =
          typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const a = el.animate([{ opacity: out ? 0 : 1 }, { opacity: out ? 1 : 0 }], {
          duration: reduce ? 80 : 260,
          fill: 'forwards',
          easing: 'ease-in-out',
        });
        a.onfinish = () => resolve();
      });
  }, []);

  useEffect(() => {
    if (screen !== 'stitch' || !wrap.current || !overlayHost.current || !fade.current) return;
    const el = wrap.current;
    const overlay = new IntentOverlay(overlayHost.current);
    const detach = attachInteraction(el, overlay, fade.current);
    return () => {
      detach();
      overlay.destroy();
      el.style.removeProperty('cursor');
    };
  }, [screen]);

  return (
    <div ref={wrap} style={{ position: 'fixed', inset: 0, touchAction: 'none' }}>
      <Canvas
        flat
        frameloop={alwaysRender ? 'always' : 'demand'}
        dpr={[1, 2]}
        gl={{ antialias: screen === 'product', alpha: false, powerPreference: 'high-performance' }}
        aria-label={
          screen === 'stitch' ? 'Embroidery hoop' : screen === 'finished' ? 'Finished piece' : 'Product'
        }
      >
        <SwatchBridge />
        {screen === 'stitch' ? <HoopScene /> : <ProductScene />}
        {DevBench && (
          <Suspense fallback={null}>
            <DevBench />
          </Suspense>
        )}
      </Canvas>
      <div ref={overlayHost} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      {!hideUi && screen === 'stitch' && (
        <>
          <Toolbar />
          <ThreadRack />
          <ThreadPicker />
          <Toast />
          <Legend />
          <StitchChrome />
          <SaveButton />
          <ZoomControl />
        </>
      )}
      {!hideUi && screen === 'product' && (
        <>
          <ProductPanel />
          <Credit />
        </>
      )}
      {!hideUi && screen === 'finished' && (
        <>
          <FinishedPanel />
          <DownloadButton />
          <Credit />
        </>
      )}
      <ConfirmDialog />
      {!hideUi && source === 'product' && <Onboarding />}
      <div
        ref={fade}
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: '#2b211b', opacity: 0 }}
      />
      {DevTools && (
        <Suspense fallback={null}>
          <DevTools hideUi={hideUi} />
        </Suspense>
      )}
    </div>
  );
}

/** Lends the WebGL renderer to the thread swatches (rack skeins, picker preview). */
function SwatchBridge() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    setSwatchRenderer(gl);
    return () => setSwatchRenderer(null);
  }, [gl]);
  return null;
}
