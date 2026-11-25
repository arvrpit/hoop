// First screen: the product in a soft studio, the hoop placed on it at true size, and the design
// drawn or placed inside the hoop. Embroidery made in the hoop view comes back here as a baked patch.
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { createPortal, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { hslToSrgb } from '../../model/color';
import { hoopSizes, productIds, products, type ProductId } from '../../model/products';
import type { Vec2 } from '../../model/types';
import { useApp } from '../../state/app';
import { useDesign } from '../../state/design';
import { session } from '../../state/session';
import { bakeStitches, embroideryMaterial } from '../bake/bakeStitches';
import { designLayer } from '../design/designCanvas';
import { prepareNotebook, prepareTote, prepareTShirt, type ProductModel } from './models';
import { productOverlay, RING_MM } from './overlay';
import {
  buildPanelInfo,
  hoopFits,
  nearestFit,
  patchGeometry,
  placeTexture,
  surfaceAt,
  type PanelInfo,
} from './placement';
import { ProductModelLoader } from './modelLoader';
import { productRuntime } from './runtime';
import { ErrorBoundary } from '../../ui/ErrorBoundary';
import { tuning } from '../../tuning';
import { useOwnCamera } from '../useOwnCamera';

// The review build loads .gltf (JSON) copies, because the review page host doesn't serve .glb.
const MODEL_EXT = import.meta.env.VITE_MODEL_EXT || '.glb';
const modelUrl = (id: ProductId) => `${import.meta.env.BASE_URL}models/${id}${MODEL_EXT}`;
const prepare: Record<ProductId, (scene: THREE.Object3D) => ProductModel> = {
  tshirt: prepareTShirt,
  tote: prepareTote,
  notebook: prepareNotebook,
};

function useStudio() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(256, 210, 40, 256, 256, 400);
    grd.addColorStop(0, '#f2eee8');
    grd.addColorStop(1, '#d8d1c7');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    const bg = new THREE.CanvasTexture(c);
    bg.colorSpace = THREE.SRGBColorSpace;
    const prev = {
      tm: gl.toneMapping,
      env: scene.environment,
      bg: scene.background,
      ei: scene.environmentIntensity,
      ca: gl.getClearAlpha(),
    };
    gl.setClearAlpha(0); // contact shadows need a transparent clear
    gl.toneMapping = THREE.NeutralToneMapping;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    scene.background = bg;
    return () => {
      gl.toneMapping = prev.tm;
      gl.setClearAlpha(prev.ca);
      scene.environment = prev.env;
      scene.background = prev.bg;
      scene.environmentIntensity = prev.ei;
      env.dispose();
      bg.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
}

function GltfModel({ id, children }: { id: ProductId; children: (m: ProductModel) => React.ReactNode }) {
  const gltf = useLoader(ProductModelLoader, modelUrl(id));
  const model = useMemo(() => prepare[id](gltf.scene), [gltf.scene, id]);
  return <>{children(model)}</>;
}

export function ProductScene() {
  useStudio();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  useOwnCamera(cam);
  const product = useApp((s) => s.product);
  useEffect(() => {
    const t = setTimeout(
      () => productIds.forEach((id) => useLoader.preload(ProductModelLoader, modelUrl(id))),
      1500,
    );
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault fov={28} near={20} far={20000} position={[0, 1300, 2200]} />
      <directionalLight position={[-900, 2300, 1500]} intensity={2.0} color="#fff1e2" />
      <directionalLight position={[1200, 1800, -1000]} intensity={0.5} color="#e8eeff" />
      <Suspense fallback={null}>
        <ErrorBoundary
          key={product}
          fallback={() => null}
          onError={(e) => useApp.getState().set({ modelError: { product, message: e.message } })}
        >
          <GltfModel id={product}>{(m) => <Product model={m} id={product} />}</GltfModel>
        </ErrorBoundary>
      </Suspense>
    </>
  );
}

function Product({ model, id }: { model: ProductModel; id: ProductId }) {
  const color = useApp((s) => s.colors[id]);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useRef<{ target: THREE.Vector3; update: () => void; enabled: boolean } | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const finished = useApp((s) => s.screen === 'finished');
  const infos = useMemo(() => {
    const out: Record<string, PanelInfo> = {};
    for (const [k, m] of Object.entries(model.panels)) out[k] = buildPanelInfo(m);
    return out;
  }, [model]);
  useEffect(() => {
    useApp.getState().set({ modelVersion: useApp.getState().modelVersion + 1 });
  }, [infos]);
  const bounds = useMemo(() => new THREE.Box3().setFromObject(model.root), [model]);

  // Product colour.
  useEffect(() => {
    const c = new THREE.Color().setRGB(...hslToSrgb(color), THREE.SRGBColorSpace);
    model.setColor(c);
    invalidate();
  }, [color, model, invalidate]);

  // Frame the product.
  useEffect(() => {
    const centre = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const dist = (Math.max(size.y, size.x * 0.8) * 1.35) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.position.set(centre.x, centre.y + size.y * 0.05, centre.z + dist);
    controls.current?.target.copy(centre);
    controls.current?.update();
    invalidate();
  }, [bounds, camera, invalidate]);

  // Camera tween (facing the hoop for drawing, and before going to stitch).
  const tween = useRef<{
    from: [THREE.Vector3, THREE.Vector3];
    to: [THREE.Vector3, THREE.Vector3];
    t0: number;
    done: () => void;
  } | null>(null);
  const faceHoop = (framing: number = tuning.faceHoopFraming) =>
    new Promise<void>((resolve) => {
      const { placement, hoopSize } = useApp.getState();
      const pl = placement[id];
      const mesh = model.panels[pl.panel];
      const s = mesh && surfaceAt(mesh, pl.u, pl.v);
      if (!s || !controls.current) return resolve();
      const dist = (hoopSize * framing) / (2 * Math.tan((camera.fov * Math.PI) / 360));
      tween.current = {
        from: [camera.position.clone(), controls.current.target.clone()],
        to: [s.point.clone().addScaledVector(s.normal, dist), s.point.clone()],
        t0: performance.now(),
        done: resolve,
      };
      invalidate();
    });
  productRuntime.faceHoop = faceHoop;
  productRuntime.capture = ({ maxWidth, pixelRatio }) => {
    const pr = gl.getPixelRatio();
    const want = pixelRatio ?? pr;
    if (want !== pr) gl.setPixelRatio(want);
    gl.render(scene, camera);
    const src = gl.domElement;
    const k = maxWidth ? Math.min(1, maxWidth / src.width) : 1;
    const out = document.createElement('canvas');
    out.width = Math.round(src.width * k);
    out.height = Math.round(src.height * k);
    out.getContext('2d')!.drawImage(src, 0, 0, out.width, out.height);
    if (want !== pr) {
      gl.setPixelRatio(pr);
      gl.render(scene, camera);
    }
    return out;
  };
  productRuntime.fits = (size: number) => {
    const pl = useApp.getState().placement[id];
    const info = infos[pl.panel];
    return !!info && nearestFit(info, pl.u, pl.v, size / 2 + RING_MM) !== null;
  };
  useFrame(() => {
    const tw = tween.current;
    if (!tw || !controls.current) return;
    const t = Math.min(1, (performance.now() - tw.t0) / 650);
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    camera.position.lerpVectors(tw.from[0], tw.to[0], e);
    controls.current.target.lerpVectors(tw.from[1], tw.to[1], e);
    controls.current.update();
    if (t >= 1) {
      tween.current = null;
      tw.done();
    } else invalidate();
  });

  const tool = useApp((s) => s.tool);
  useEffect(() => {
    if (tool !== 'move') void faceHoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Pointer: drag the hoop (Move), draw (Pen / Eraser), move the image (Image).
  const drag = useRef<{ kind: 'hoop' | 'pen' | 'image'; panel: string; grab: Vec2; start: Vec2 } | null>(
    null,
  );
  const hoopLocal = (u: number, v: number): Vec2 => {
    const pl = useApp.getState().placement[id];
    return { x: u - pl.u, y: -(v - pl.v) };
  };
  const panelOf = (o: THREE.Object3D) => Object.entries(model.panels).find(([, m]) => m === o)?.[0];

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (useApp.getState().screen === 'finished') return; // finished pieces only turn
    const panel = panelOf(e.object);
    if (!panel || !e.uv || e.button !== 0) return;
    const { placement, hoopSize, tool: t } = useApp.getState();
    const pl = placement[id];
    const local = hoopLocal(e.uv.x, e.uv.y);
    const inHoop = panel === pl.panel && Math.hypot(local.x, local.y) <= hoopSize / 2 + RING_MM;
    if (t === 'move') {
      if (!inHoop) {
        // Clicking another spot on a panel moves the hoop there if it fits.
        if (panel !== pl.panel || Math.hypot(local.x, local.y) > hoopSize / 2 + RING_MM) return;
      }
      drag.current = {
        kind: 'hoop',
        panel,
        grab: { x: e.uv.x - pl.u, y: e.uv.y - pl.v },
        start: { x: e.uv.x, y: e.uv.y },
      };
    } else if (inHoop && (t === 'pen' || t === 'eraser')) {
      useDesign.getState().begin();
      const d = useDesign.getState();
      d.set({
        strokes: [
          ...d.strokes,
          {
            points: [local],
            widthMm: useApp.getState().penWidthMm * (t === 'eraser' ? 3 : 1),
            erase: t === 'eraser',
          },
        ],
      });
      drag.current = { kind: 'pen', panel, grab: local, start: local };
    } else if (inHoop && t === 'image' && useDesign.getState().image) {
      useDesign.getState().begin();
      const im = useDesign.getState().image!;
      drag.current = { kind: 'image', panel, grab: { x: local.x - im.x, y: local.y - im.y }, start: local };
    } else return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (controls.current) controls.current.enabled = false;
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || !e.uv || panelOf(e.object) !== d.panel) return;
    e.stopPropagation();
    if (d.kind === 'hoop') {
      const { hoopSize, placement } = useApp.getState();
      const u = e.uv.x - d.grab.x;
      const v = e.uv.y - d.grab.y;
      if (hoopFits(infos[d.panel]!, u, v, hoopSize / 2 + RING_MM)) {
        useApp.getState().set({ placement: { ...placement, [id]: { panel: d.panel, u, v } } });
      }
    } else if (d.kind === 'pen') {
      useDesign.getState().addPoint(hoopLocal(e.uv.x, e.uv.y));
    } else {
      const local = hoopLocal(e.uv.x, e.uv.y);
      const im = useDesign.getState().image!;
      useDesign.getState().set({ image: { ...im, x: local.x - d.grab.x, y: local.y - d.grab.y } });
    }
  };

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (controls.current) controls.current.enabled = useApp.getState().tool === 'move' || finished;
  };

  // The flow waits for this before turning the camera (Save & render, opening a saved piece).
  useEffect(() => {
    // Suspense hides what is on screen while the next product loads; a cached model that was
    // swapped out while hidden would otherwise come back invisible.
    model.root.visible = true;
    invalidate();
    if (useApp.getState().modelError) useApp.getState().set({ modelError: null });
    productRuntime.setReady(true);
    return () => productRuntime.setReady(false);
  }, [model, invalidate]);

  // Keep the hoop valid when the size or product changes (slide to the nearest spot that fits).
  const hoopSize = useApp((s) => s.hoopSize);
  const placement = useApp((s) => s.placement[id]);
  useEffect(() => {
    const info = infos[placement.panel];
    if (!info) return;
    const fit = nearestFit(info, placement.u, placement.v, hoopSize / 2 + RING_MM);
    if (!fit) {
      // Too big for this product: step down to the largest hoop that fits.
      const smaller = [...hoopSizes]
        .reverse()
        .find((s) => s < hoopSize && nearestFit(info, placement.u, placement.v, s / 2 + RING_MM));
      if (smaller) useApp.getState().set({ hoopSize: smaller });
      return;
    }
    if (fit && (fit.u !== placement.u || fit.v !== placement.v)) {
      useApp
        .getState()
        .set({ placement: { ...useApp.getState().placement, [id]: { ...placement, ...fit } } });
    }
  }, [hoopSize, placement, infos, id]);

  return (
    <>
      <OrbitControls
        ref={controls as never}
        makeDefault
        enablePan={false}
        enabled={tool === 'move' || finished}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 + 0.2}
        minDistance={250}
        maxDistance={4500}
        enableDamping={false}
      />
      <primitive object={model.root} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
      <HoopPatch model={model} id={id} />
      <ContactShadows
        position={[0, bounds.min.y - 4, (bounds.min.z + bounds.max.z) / 2]}
        scale={Math.max(bounds.max.x - bounds.min.x, 400) * 2}
        far={(bounds.max.y - bounds.min.y) * 0.6}
        blur={2.6}
        opacity={0.35}
        resolution={512}
      />
    </>
  );
}

/** The hoop + design overlay and the baked embroidery, laid onto the panel's own triangles. */
function HoopPatch({ model, id }: { model: ProductModel; id: ProductId }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const placement = useApp((s) => s.placement[id]);
  const hoopSize = useApp((s) => s.hoopSize);
  const screen = useApp((s) => s.screen);
  const mesh = model.panels[placement.panel];
  const [hasEmb, setHasEmb] = useState(false);

  useEffect(() => {
    designLayer.setHoop(hoopSize);
    productOverlay.set(hoopSize, true);
    invalidate();
  }, [hoopSize, invalidate]);
  useEffect(() => designLayer.onChange(() => invalidate()), [invalidate]);

  const overlayMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: productOverlay.texture,
        transparent: true,
        depthWrite: false,
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      }),
    [],
  );
  const embMat = useMemo(() => embroideryMaterial(), []);
  useEffect(
    () => () => {
      overlayMat.dispose();
      embMat.dispose();
    },
    [overlayMat, embMat],
  );

  const geom = useMemo(
    () => (mesh ? patchGeometry(mesh, placement.u, placement.v, productOverlay.sizeMm / 2 + 4) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesh, placement.u, placement.v, hoopSize],
  );
  useEffect(() => () => geom?.dispose(), [geom]);

  useEffect(() => {
    placeTexture(productOverlay.texture, placement.u, placement.v, productOverlay.sizeMm);
    invalidate();
  }, [placement.u, placement.v, hoopSize, invalidate]);

  // Bake what has been stitched for this product whenever we arrive here.
  useEffect(() => {
    if (screen === 'stitch' || !session.pieceHasStitches()) {
      setHasEmb(false);
      return;
    }
    // The stitch layer shows the active piece, so make the current piece active first.
    session.activate(products[id].fabric, hoopSize);
    const bake = bakeStitches(gl, hoopSize);
    // Use the render targets' own textures: a clone would not share their GPU texture.
    placeTexture(bake.albedo, placement.u, placement.v, bake.sizeMm);
    placeTexture(bake.normal, placement.u, placement.v, bake.sizeMm);
    embMat.map = bake.albedo;
    embMat.normalMap = bake.normal;
    // Baked normals are in hoop space (x right, y up); the panel UVs run the same way once
    // placeTexture flips v, so no sign change.
    embMat.normalScale.set(1, 1);
    embMat.needsUpdate = true;
    setHasEmb(true);
    invalidate();
  }, [screen, id, hoopSize, placement.u, placement.v, gl, embMat, invalidate]);

  if (!mesh || !geom) return null;
  return createPortal(
    <>
      {screen !== 'finished' && (
        <mesh geometry={geom} material={overlayMat} renderOrder={2} raycast={() => null} />
      )}
      {hasEmb && <mesh geometry={geom} material={embMat} renderOrder={3} raycast={() => null} />}
    </>,
    mesh,
  );
}

useLoader.preload(ProductModelLoader, modelUrl('tshirt'));
