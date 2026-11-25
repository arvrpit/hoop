// Look-test tools: leva tuning panel, frame counter, and a test hook for Playwright. Included in dev
// and in the review build; stripped from the production build.
import { useEffect } from 'react';
import { useApp } from '../state/app';
import { hslToHex } from '../model/color';
import { productRuntime } from '../render/product/runtime';
import * as flow from '../state/flow';
import { useDesign } from '../state/design';
import { camera } from '../state/camera';
import { render } from '../state/render';
import { session, useSession } from '../state/session';
import { useHoop, type HoopState } from '../state/store';
import { DevPanel } from './DevPanel';
import { FpsMeter } from './FpsMeter';

declare global {
  interface Window {
    __hoopProduct?: typeof productRuntime;
    __hoopFlow?: typeof flow;
    __hoop?: {
      set: (patch: Partial<HoopState>) => void;
      get: () => HoopState;
      app: (patch?: Record<string, unknown>) => unknown;
      design: (patch?: Record<string, unknown>) => unknown;
      /** Draw a few frames and resolve (the scene normally draws only on demand). */
      flush: (frames?: number) => Promise<void>;
      state: () => {
        tool: string;
        stitchType: string;
        camera: { mode: string; zoom: number; focus: { x: number; y: number }; gliding: boolean };
        front: number;
        knots: number;
        punctures: number;
        needle: { x: number; y: number } | null;
        animating: boolean;
        thread: string | null; // name of the thread on the needle
        threads: { name: string; hex: string; material: string; strands: number }[];
      };
    };
  }
}

export default function DevTools({ hideUi }: { hideUi: boolean }) {
  const hidePanel = useHoop((s) => s.hidePanel);
  useEffect(() => {
    window.__hoopProduct = productRuntime;
    window.__hoopFlow = flow;
    window.__hoop = {
      set: (p) => useHoop.getState().set(p),
      app: (p) => {
        if (p) useApp.getState().set(p as never);
        return useApp.getState();
      },
      design: (p) => {
        if (p) useDesign.getState().set(p as never);
        return useDesign.getState();
      },
      get: () => useHoop.getState(),
      flush: (frames = 4) =>
        new Promise((resolve) => {
          let n = 0;
          const tick = () => {
            render.invalidate();
            if (++n >= frames) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      state: () => ({
        tool: useSession.getState().tool,
        stitchType: useSession.getState().stitchType,
        camera: {
          mode: camera.mode,
          zoom: camera.view.zoom,
          focus: { ...camera.view.focus },
          gliding: camera.gliding,
        },
        front: session.engine.stitches.filter((s) => s.side === 'front').length,
        knots: session.engine.knots.length,
        punctures: useSession.getState().punctures,
        needle: session.needleAt(),
        animating: false,
        thread: useSession.getState().thread?.name ?? null,
        threads: session.engine.piece.threads.map((t) => ({
          name: t.name,
          hex: hslToHex(t.color),
          material: t.material,
          strands: t.strands,
        })),
      }),
    };
  }, []);
  return (
    <>
      <DevPanel hidden={hideUi || hidePanel} />
      {!hideUi && <FpsMeter />}
    </>
  );
}
