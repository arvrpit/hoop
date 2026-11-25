# Hoop: handoff notes (for a new chat)

_Written 2026-11-24. Paste or attach this file in a new chat to carry on. Project folder: `/Users/arpitsingh/Claude experiment/hoop/`._

**Kickoff message for the new chat:**

> Read `hoop/HANDOFF.md` and `hoop/SPEC.md` (especially §14, the decisions log). We're partway through the "product-first flow" phase. Finish the **Remaining work** list in HANDOFF.md in order, then stop for my review. Plan before big changes; I want to save tokens.

---

## Latest status (end of 2026-11-24)

The product-first flow is reviewed. The owner's follow-ups are **built and checked**, waiting for their review:
- **Real tote and notebook models** (`public/models/tote.glb`, `notebook.glb`), both CC BY 4.0. Credits with licence links are in `products.ts`.
  - Loaders are in `render/product/models.ts` (`prepareTote`, `prepareNotebook`). Each bakes its meshes into fresh mm geometry, so the cached glTF is never changed.
  - **Tote:** the front panel is the mesh with material `Mat_Truoc_Tui*`, given flat mm UVs; the body is scaled to 380 mm wide.
  - **Notebook:** a scan in cm, stood upright. Cover vs pages is decided by sampling the scan's base-colour texture (dark = leather → linen cloth); the front cover is the triangles facing +Z.
  - The procedural stand-ins are deleted.
- **One piece at a time** (SPEC §14):
  - `session` keeps one current piece (`activate`, `pieceHasStitches`, `snapshot`, `loadPiece`, `newPiece`).
  - The product is locked once there are stitches; switching asks via `askConfirm` (`state/ui.ts` + `ui/Dialog.tsx`).
- **Save & render:**
  - `SaveButton` sits top right in the hoop view, then `flow.finishAndSave`, then the new `'finished'` screen: the product scene with no ring and no guide, `FinishedPanel`, and `DownloadButton` (`flow.downloadImage`).
  - **Your pieces** (`state/shelf.ts`, IndexedDB `hoop/pieces`; `ui/Shelf.tsx` in the product panel). Records are `model/savedPiece.ts`.
  - Opening one → `flow.openSaved` → finished view; **Keep stitching** → back into the hoop, and saving updates the same id.
- **Two bugs found and fixed on the way:**
  - A cached model swapped out while React Suspense had hidden it came back invisible. `Product` now sets `model.root.visible = true` on mount.
  - drei `makeDefault` camera hand-back could leave the other screen's camera in charge. `render/useOwnCamera.ts` makes each scene re-claim its own camera.
- **Dev hooks:** `window.__hoopProduct` (productRuntime) and `window.__hoopFlow` (flow functions) were added for probes.
- **Checks:** 73 unit tests pass (new: `tests/savedPiece.test.ts`), and e2e passes (`e2e/product.spec.ts` now covers lock, Save & render, download, Keep stitching, shelf, reopen and reload).
- **Review page (v7):** the artifact host blocks `data:`/`blob:` fetches and WebAssembly, and only serves plain file types.
  - So `build:review` turns each GLB into a `.gltf.json` with the buffer as base64 text (`buffers[0].extras.base64`), plus separate image files (`notebook-0.jpg`, …).
  - `render/product/modelLoader.ts` (`ProductModelLoader`, used via R3F `useLoader`) repacks that into a .glb in memory. drei `useGLTF` is gone, because its decoder needs WebAssembly.
  - v6 crashed to a brown screen there; that's fixed, and an `ErrorBoundary` now keeps the app up with a message if a model fails.
  - To test a build under a strict policy, serve `dist-review` with a CSP header (`default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:`) and run `scripts/probe.mjs`.
  - IndexedDB may also be blocked there; the shelf then says saving isn't available.
- **Not done yet:** autosave of work in progress (M5); naming or renaming pieces; the notebook's ribbon bookmark is cloth-coloured (it's brown in the scan).

## Latest: M4 threads + onboarding (2026-11-25), waiting for the owner's review

- **Built and checked** (SPEC §14, the five 2026-11-25 M4/onboarding entries):
  - Thread rack `ui/ThreadRack.tsx`; picker `ui/ThreadPicker.tsx` (RGB, colour card, shades, material, strands); swatches `ui/Skein.tsx`, `ui/ThreadPreview.tsx`, drawn by `render/swatch/swatches.ts` (the renderer is lent by `SwatchBridge` in `screens/AppScreen.tsx`); toasts `ui/Toast.tsx`; onboarding `ui/Onboarding.tsx`.
  - Session thread actions: `pickThread`, `addThread`, `updateThread`, `removeThread`, `previewThreads` (live recolour while editing), `threadAt` (eyedropper, via the pure `model/eyedropper.ts`). `useSession` now has `threads` and `openThreadIds`.
  - Colour helpers in `model/color.ts` (RGB ↔ HSL, hex, `shadeRow`); colour card and names in `model/threadColors.ts`.
  - Controller: keys 1–9, Alt/Option+click and press-and-hold eyedropper (`tuning.longPressMs`), Alt shows a copy cursor.
- **Checks:** 84 unit tests (new `tests/threads.test.ts`), 20 e2e (new `e2e/m4.spec.ts` = the reference tree on a tote, and `e2e/onboarding.spec.ts`). e2e runs with `e2e/storage.json` so onboarding is already seen. Review page **v9**, tested under a strict CSP first.
- **Thread drawer (owner's follow-up):** the rack now hides off the left edge with only the thread on the needle peeking out; hover the edge (or Tab, or tap the skein) to slide it out. The thread on the needle sits out of line; no needle glyph. `useDrawer` in `ui/ThreadRack.tsx`; e2e opens it with `openRack()` and hovers a skein before clicking its ⋯ (`threadMenu()`).
- **Next:** the owner's review of M4 and onboarding, then **M5** (autosave, JSON import/export, PNG export).

## Added on 2026-11-25

- **Stitch tool hover cards:** cross-section diagrams (`ui/stitchGuide.ts` data + `ui/StitchDiagram.tsx`), rendered in a portal on `<body>` because the toolbar's centring transform would anchor a fixed card to itself.
- **In/out chevrons** on the crosshair (`ui/intentOverlay.ts`, CSS animation; the direction comes from the engine preview in `interaction/controller.ts`).
- Tested in `e2e/m3.spec.ts` ("Stitch tools…"); screenshots are `review/m3/diagram-*.png` and `chevrons-*.png`.

## 1. What Hoop is

A calm web app for embroidering on a realistic fabric canvas, then seeing the piece on products. It's built with Vite, React, TypeScript, three.js (react-three-fiber and drei), zustand, culori, leva (look panel), vitest and Playwright. Units are millimetres everywhere. `SPEC.md` is the source of truth. **Its §14 decisions log overrides earlier sections.**

**Owner preferences:**
- Plan first and wait for a go-ahead.
- Stop for review at milestones.
- Every feel and look number goes in `src/tuning.ts`.
- The owner is a product designer; keep explanations plain.

## 2. Run and check

```bash
cd hoop && npm install && npx playwright install chromium
npm run dev            # http://localhost:5183 (Claude desktop: launch.json entry "hoop")
npm test               # vitest
npm run lint && npm run build
npx playwright test    # e2e: screenshots, perf, m3, webgl-fallback (see section 6)
npm run build:review && node scripts/review-page.mjs   # shareable review build → review/artifact/index.html
```

**URL options:**

| Option | What it does |
|---|---|
| `hoop=1` | Open straight into the hoop view |
| `demo=1` | The M1 demo piece |
| `stress=20000` | The 20,000-stitch stress test |
| `fabric=linen` | Plain hoop of that fabric (sets source to blank) |
| `zoom=3&fx=&fy=` | Camera zoom and focus (mm) |
| `panel=0` | Hide the leva look panel |
| `ui=0` | Hide all controls |
| `rm=1` | Reduced motion |
| `always=1` | Draw every frame |

**Dev hooks on `window`:**
- `__hoop.set/get/flush/state/app/design`
- `__hoopInteraction.toScreen/frame`
- `__hoopPlatform = 'mac' | 'win'` (set before load)
- `__hoopBench(n)`

**Helper scripts:**
- `scripts/probe.mjs <url> out.png [x,y,w,h]` renders a URL headlessly on the real GPU and prints console errors. `PROBE_JS="…"` runs JavaScript in the page before the screenshot.
- `scripts/contact.mjs out.png <cols> files…` builds a contact sheet (set `SHEET_W` for the width).
- `scripts/sample.mjs` averages colours in an image.

**Shareable review page:** https://claude.ai/artifact/BGrkran2djkWBsFPMEp38C (private). It's at version 7, which includes your models, Save & render and Your pieces, and works under the host's strict security policy.

## 3. Status by milestone

| Milestone | Status |
|---|---|
| M0 setup | Done |
| M1 look test | Done, **approved** by the owner |
| M2 stitch engine | Done |
| M3 stitching interaction | Built and QA'd (10 Playwright checks passed at the time). The owner then changed the architecture before formally approving. |
| **Product-first flow** (new phase, replaces part of M6) | Done |
| M4 threads and colour (+ onboarding) | Built and checked, waiting for review |
| M5 saving and export, M6 importing your own models, M7 polish | Not started |

## 4. Owner decisions so far

Items 1–10 are already in SPEC §14. **Items 11–17 are not yet in §14: add them.**

1. **Thread look (M1):**
   - Floss `plies` means plies per strand (2), with 2 strands visible side by side.
   - Perle twist is 0.6/mm.
   - Highlights use an eye tilted 22° toward the viewer.
   - `threadExposure` 0.76 keeps stitched colour true to its swatch.
2. **Holes only in weave gaps:** on woven fabrics the needle only goes through the gaps the weave leaves. Option A, every gap: cotton 0.45 mm, linen 0.625 mm, Aida 1.814 mm. Felt is free placement quantised to 0.3 mm.
3. **Snapping to used holes:** the magnet uses a bias (`existingHoleBias` 0.35 × spacing), so the next hole along stays reachable for satin.
4. **Stitch order:** `Puncture.seq` records global creation order, so resumed runs stack on top.
5. **The lamp stays still;** the camera does the moving.
6. **Tools:** View (H) and Stitch (R / B / S / K) in a FigJam-style bottom toolbar. The crosshair, ring and guideline appear only in Stitch mode.
7. **Moving around:** on macOS a two-finger swipe pans, and pinch or ⌘ + scroll zooms. On Windows the wheel zooms, and Space + drag or middle-drag pans. Dragging with the View tool pans everywhere.
8. **Intent kept separate from action:** the crosshair, ring and faint guideline are interface (an SVG overlay), never thread. Thread renders only after the click (pull-through, dimple, knot pop). Undo is an unpick animation.
9. **Legend:** collapsible, bottom left, toggled with `?`. It replaces the shortcut sheet and the first-run card.
10. **Rendering on demand:** frames are drawn only while something moves.
11. **NEW, no automatic camera at all:**
    - Removed: glide-in, recentre after a stitch, idle step-back.
    - The user zooms and pans freely to see the composition.
    - Left: **Fit** (button, Shift+1; a 450 ms glide, an instant cut with reduced motion), `+` / `−` keys, and a zoom control at the bottom right.
    - Esc switches to the View tool.
    - A click in Stitch mode makes a hole at any zoom.
12. **NEW, product-first flow:**
    - The first screen is a 3D product (T-shirt, tote bag or notebook, switchable).
    - You choose a hoop size (100 / 150 / 200) and its spot by dragging or presets, at true size in the product's millimetre pattern UVs.
    - Product colour swatches set the hoop fabric colour.
    - **Start stitching** faces the camera to the hoop, fades, and opens the hoop view.
    - **← Product** goes back, showing the **embroidery baked onto the product**.
13. **NEW, design step:** on the product screen you can draw (pen, eraser) or upload a PNG, JPEG or SVG and move, scale and rotate it inside the hoop. It's clipped to the hoop circle. It's a **guide you stitch over** (like a washable transfer pen): traced on the hoop fabric with an opacity slider and show/hide, and **not** printed on the finished product.
14. **NEW, fabric per product:** T-shirt is jersey knit (new shader, holes 0.7 mm between loops), tote is canvas (plain weave, 1/1.4 mm), notebook is linen book cloth.
15. **NEW, crowded holes:** the ring warns (dashed) when a click would be the 4th pass through a hole, and refuses the 6th (`holeCrowdWarn` / `holeCrowdMax`).
16. **NEW, plain fabrics:** the four plain-hoop fabrics stay in the leva look panel only, for testing.
17. **NEW, models and lighting:**
    - The owner will **supply GLB models for the tote and notebook** (and maybe a new T-shirt) in `public/models/`, ideally with mm UVs, plus licence or credit info.
    - Until then the tote and notebook are procedural stand-ins with mm UVs.
    - The T-shirt credit shows bottom right whenever the T-shirt is on screen (later also in an About / Credits menu).
    - Studio lighting uses three's `RoomEnvironment`, generated in code; no HDRI download.

## 5. Architecture map (`src/`)

- **`tuning.ts`:** all numbers, plus the `fabrics` (cotton, linen, aida14, felt, **jersey**, **canvas**) and `threadMaterials` maps.
- **`model/` (pure, tested):**
  - `types.ts`
  - `holes.ts`: lattice and `snapPoint` with the magnet bias.
  - `stitchEngine.ts`: `StitchEngine` with click, preview (incl. `crowd`), tieOff, setStitchType, pickThread, threads, undo/redo with ChangeSets, `setHoopDiameter`, `crowdAt`.
  - `history.ts`, `piece.ts`, `color.ts`
  - `demoPiece.ts`: built by clicking through the engine.
  - `products.ts`: product definitions (fabric, swatches, presets, panels, credit; hoop sizes).
- **`state/`:**
  - `store.ts` (`useHoop`): look settings, source `'product' | 'blank' | 'demo' | 'stress'`, and a zoom/focus mirror. Setting zoom or focus jumps the camera.
  - `session.ts`: the engine; **one piece per product** via `activate(product, fabric, hoop)`; tools; event feed.
  - `camera.ts` (the CameraDirector singleton), `render.ts` (invalidate and onFrame hooks), `ui.ts` (legend open state).
  - `app.ts` (`useApp`): screen, product, colours, hoopSize, placement per product, design tool, pen width, modelVersion.
  - `design.ts` (`useDesign`): strokes, image, visible, opacity, undo.
  - `flow.ts`: `enterStitch`, `startStitching`, `backToProduct`, fader.
- **`interaction/`:**
  - `cameraDirector.ts`: manual zoom, pan, Fit, jumpTo.
  - `controller.ts`: pointer, wheel, gestures, keys, intent overlay updates, crowd and tug, and `zoomHooks` for the zoom control.
  - `projection.ts`: screen ↔ hoop conversion, `isMac`, `wheelAction`.
- **`render/hoop/`:**
  - `HoopScene.tsx`: OrthographicCamera makeDefault, SceneDriver, shadow pass, fabric, stitches, knots, ring.
  - `layerStore.ts`: the **app-wide StitchLayer singleton**, subscribed to the session.
  - `stitchLayer.ts`: incremental instance buffers and animations; `finishAnimations()`.
  - Materials, uniforms (incl. `guideUniforms`), threadTable, instances.
- **`render/shaders/`:** GLSL.
  - `fabric.frag` has kinds 0 (plain), 1 (aida), 2 (felt) and **3 (jersey)**, plus the **guide texture** (`uGuideTex`, `uGuideOn`, `uGuideOpacity`, `uGuideSize`).
  - Thread code is in `common/thread.glsl`; the depth pre-pass is `stitchDepth.frag`.
- **`render/design/designCanvas.ts`:** `designLayer`, a 2048 px canvas in hoop space clipped to the circle, which also drives `guideUniforms`. `loadImageFile()` handles PNG, JPEG and SVG (SVGs are rasterised; large images are shrunk to 2048 px).
- **`render/product/`:**
  - `ProductScene.tsx`: PerspectiveCamera, OrbitControls, the studio, `Product` (colour, framing, face-hoop tween, pointer handling for hoop drag, pen and image), `HoopPatch` (overlay plus baked embroidery on cloned panel triangles), and `productRuntime.faceHoop/fits`.
  - `models.ts`: `prepareTShirt` (reset the Sketchfab nodes, ×1000, knit material, front panel `Object_10`, back panel = the outer one facing −Z among `Object_14/15/16`, non-panels don't take raycasts), `buildTote`, `buildNotebook`.
  - `placement.ts`: `buildPanelInfo` (UV coverage grid), `hoopFits`, `nearestFit`, `patchGeometry`, `surfaceAt`, `placeTexture`.
  - `overlay.ts`: the product overlay canvas (wooden ring plus design).
  - `textures.ts`: knit and weave tiles in mm.
- **`render/bake/bakeStitches.ts`:** bakes stitches to albedo and normal half-float render targets (2048²) with the thread shader's output modes 1 and 2. `embroideryMaterial()` un-premultiplies colour and normals.
- **`screens/AppScreen.tsx`:** **one Canvas** that switches HoopScene and ProductScene, the fade overlay, and the per-screen UI. The interaction controller is attached only on the stitch screen.
- **`ui/`:**
  - `Toolbar`, `Legend` (updated for manual zoom), `intentOverlay.ts` (ring kinds normal, magnet, warn, full, invalid)
  - `ProductPanel` (+ `Credit`), `StitchChrome` (back button, guide toggle and opacity) + `ZoomControl`
  - `icons.tsx`, `ui.css`
- **`dev/`:** leva DevPanel (resizable), DevTools hooks, FpsMeter (top centre), DevBench.

## 6. Where the current phase stands

**Done and checked:**
- Types compile.
- **56 unit tests pass**: engine, holes, history, camera with manual zoom, wheel actions, crowded holes, demo piece.
- The jersey shader looks right at 8×.
- The product screen renders the T-shirt, tote and notebook stand-in with hoop rings, the panel and the credit.
- The contact shadow is fixed (transparent clear alpha on the product screen).

**Built but not yet verified (do this first):**
- Pen and eraser drawing on the product (the camera should face the hoop when the tool changes).
- Image upload (file picker and drag-drop), move, width, turn and clipping.
- The Start stitching transition, then the guide traced on the hoop fabric.
- Stitching on jersey, canvas and linen; per-product pieces; changing hoop size with stitches present.
- **The baked embroidery on the product after ← Product.** Check orientation; the normal-map sign is a guess (`embMat.normalScale.set(1, -1)`), and so is the un-premultiply.
- The zoom control and Shift+1.
- The Esc → View tool change.

**Lint:** 1 error, `no-useless-assignment` at line ~274 of a test file (most likely the `crowded holes` test in `tests/stitchEngine.test.ts`; run `npm run lint` to see). Plus 3 warnings:
- a stale `eslint-disable` around line 386 in `ProductScene.tsx`
- the `wrap.current` cleanup in `AppScreen.tsx`
- react-refresh in a UI file that exports constants (e.g. `ProductScene.tsx` exports `productRuntime`; consider moving it to its own module)

## 7. Remaining work, in order

_Items 1–9 are done, and M4 in item 10 is built (see the top). Next is M5, after the owner's review._

1. **Fix lint** (above), then run `npx prettier --write src tests e2e`, `npm run build`, and check dev tools are still stripped (`grep -c useControls dist/assets/*.js` → 0).
2. **Update the e2e specs for the new start screen:**
   - `e2e/screenshots.spec.ts`: goto `/?ui=0&demo=1&hoop=1`.
   - `e2e/perf.spec.ts`: `/?stress=20000&hoop=1`, keep `alwaysRender: true`.
   - `e2e/m3.spec.ts`: open with `?idle=0&panel=0&hoop=1` (`idle` is now a no-op; remove it). Then:
     - **Remove** the glide-in, recentre and idle tests.
     - Replace test 1 with "clicking never moves the camera; a click makes a hole at any zoom".
     - Add Fit (Shift+1 → zoom 1) and `+` / `−` zoom tests.
     - Add Esc → View tool.
     - Before precise clicking, do `__hoop.set({ zoom: 3 })` (the default fabric is now jersey, 0.7 mm holes).
     - In the recording, zoom with `+` instead of gliding.
     - The legend hint text changed.
3. **Write `e2e/product.spec.ts`:**
   - Credit visible on the T-shirt.
   - Switching to tote and notebook (notebook: 150 and 200 disabled).
   - Hoop drag via the presets.
   - Upload a PNG (`setInputFiles` with a generated buffer); check `__hoop.design().image`.
   - Pen stroke by mouse drag after the face-hoop tween (about 700 ms).
   - Start stitching → `__hoop.app().screen === 'stitch'`, guide on.
   - Stitch a few holes.
   - ← Product, then a screenshot showing the embroidery on the shirt.
   - Save screenshots to `review/product/`.
4. **Fix whatever step 3 turns up.** The bake orientation and normals are the most likely.
5. **Unit tests for `render/product/placement.ts`:** `hoopFits`, `nearestFit` and `patchGeometry` on a simple `PlaneGeometry` with mm UVs.
6. **Docs:**
   - Add decisions 11–17 to SPEC §14.
   - Update the README: the product-first flow, the `hoop=1` option, and the new controls.
   - Update the memory file `~/.claude/projects/-Users-arpitsingh-Claude-experiment/memory/hoop-embroidery-app.md`.
7. **Review page:** run `npm run build:review` and `node scripts/review-page.mjs`, then publish `review/artifact/index.html` to the same URL. Include `files` for the new `dist-review/assets/*` and **`models/tshirt.glb`** (6.8 MB; set a `contentType` such as `model/gltf-binary` or `application/octet-stream` if it's refused). Set the old asset paths to `null`. Model URLs already use `import.meta.env.BASE_URL`.
8. **Stop for the owner's review** of the product-first flow. Ask for the tote and notebook GLBs and their licences.
9. **When the models arrive:**
   - Load them like the T-shirt (`useGLTF`, normalise to mm, pick the panel meshes).
   - If they lack mm UVs, add a **projected-decal fallback** (drei `<Decal>` at the raycast point and normal, sized to the hoop) for the overlay and the embroidery.
   - Add their credits to `products.ts`.
10. **Then continue the milestones:**
    - **M4:** thread rack, HSL picker with OKLCH nudges, material and strands, Alt+click pickup, 1–9 keys. The toolbar already has the swatch slot.
    - **M5:** autosave to localStorage (pieces, products and design; note image data URLs can be large), JSON import/export, PNG export.
    - **M6:** importing your own models (glb, gltf, obj, stl), triplanar fabric material, click-to-place decal.
    - **M7:** sounds, timing pass.

## 8. Known risks and notes

- **Dev server:** the Claude desktop dev-server process stops between sessions; restart it with `preview_start` (`hoop`). The in-app browser pane is blocked from localhost and claude.ai, so verify with Playwright and `scripts/probe.mjs`.
- **Frame rate:** with the 20,000-stitch worst case, M3 measured about 6 ms per frame at 2880×1800 on an M4 Pro (GPU-synced). That hasn't been re-measured since the product screen and jersey shader were added. The jersey shader does 18 leg evaluations per pixel; check its cost.
- **Saving:** per-product pieces and the design are in memory only until M5.
- **Placement after stitching:** moving the hoop after stitching moves the design with it. Hoop size changes are allowed only if the stitches still fit (`session.fitsHoop`).
- **T-shirt panel names** (`Object_10` front; back chosen by normals) come from the supplied GLB. A new T-shirt model will need new panel picking.
