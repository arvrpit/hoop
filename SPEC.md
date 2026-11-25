# Hoop — Embroidery Canvas MVP Spec

_Working name: **Hoop**. A calm, meditative web app where people embroider on a realistic fabric canvas, then see their piece on products (T-shirt, tote bag, notebook)._

---

## 0. How to use this spec (read first, agent)

- Build **milestone by milestone** (section 11). Do not start the next milestone until the current one meets its acceptance checks.
- **Stop and ask for review** after **M1 (look test)** and **M3 (stitching interaction)**. Take screenshots with Playwright at the zoom levels listed and show them. These two milestones decide whether the product feels right; everything else depends on them.
- Keep **all tunable numbers in `src/tuning.ts`** (section 10). The owner is a product designer and will tweak feel by editing that one file.
- Keep **pure logic (stitch engine, snapping, color) free of React/three.js** and unit-tested.
- Do not add features listed in **Non-goals** (section 2). If something seems necessary, ask first.
- Do not add dependencies beyond section 3 without a one-line reason in the PR/commit message.

**Kickoff message to paste into the agent:**

> Read SPEC.md in the repo root. Set up the project (M0), then build M1 (the look test). Stop after M1 and show me screenshots at 1×, 3× and 8× zoom with all four thread materials and all four fabrics. Don't start M2 until I approve the look.

---

## 1. Product summary

The MVP has two screens:

1. **Stitch** — a round embroidery hoop seen top-down (orthographic camera) with realistic fabric and thread, ambient + key + focus-lamp lighting. The user embroiders by puncturing holes one at a time, guided by a crosshair and a preview thread. The camera gently zooms into where they work and steps back when they pause. They can switch between multiple threads (colors/materials) mid-piece.
2. **Mockup** — the finished piece rendered onto 3D products (T-shirt, tote bag, notebook) and onto any model the user imports (e.g. one made in Womp), with orbit, product color and placement controls, and PNG export.

**The MVP succeeds if:** stitching feels calm, precise and satisfying; threads look like real fibres (round, twisted, with sheen), not lines; and the same piece looks convincing on all three products.

**Reference scenario (use this to test):** stitch a small tree. Brown back-stitch for the trunk and branches → switch to green → satin-stitch leaves → switch back to brown and continue a branch from where it left off → add a few French knots as fruit in red → view it on a tote bag.

---

## 2. Non-goals for the MVP

Do **not** build these now (they're on the roadmap, section 13):

- Touch/mobile input (desktop mouse/trackpad only; don't break touch, just don't design for it)
- Accounts, backend, cloud save, sharing links, multiplayer
- Back-of-fabric view, time-lapse replay
- Stitch types beyond: Running, Back, Satin, French knot
- Photo-based (2D displacement) mockups, AI-generated scenes
- Machine-embroidery export (.DST/.PES), real floss-number matching
- Pattern/template library, guided patterns
- Sound is a stretch goal (M7), not required

---

## 3. Tech stack

- **Vite + React + TypeScript** (strict mode)
- **three.js** via **@react-three/fiber** and **@react-three/drei**
- **zustand** for app state (with a separate undo/redo history module)
- **culori** for color conversion (HSL ↔ linear sRGB, OKLCH)
- **leva** for a dev-only tuning panel (excluded from production build)
- **vitest** for unit tests, **Playwright** for screenshot checks
- No backend. Persistence = `localStorage` (wrapped in try/catch) + JSON export/import.
- Requires **WebGL2**; show a friendly message if unavailable.

Units: **1 world unit = 1 millimetre** everywhere (hoop, stitches, products). This keeps embroidery at true physical size on products.

---

## 4. Data model (pure TypeScript, `src/model/`)

```ts
type Vec2 = { x: number; y: number };            // mm, hoop space, origin = hoop centre

type FabricId = 'cotton' | 'linen' | 'aida14' | 'felt';
type ThreadMaterial = 'floss' | 'perle' | 'silk' | 'wool';
type StitchType = 'running' | 'back' | 'satin' | 'knot';

interface HSL { h: number; s: number; l: number } // h 0–360, s/l 0–100

interface Thread {
  id: string;
  name: string;               // auto-named, e.g. "Bark brown", editable
  color: HSL;
  material: ThreadMaterial;
  strands: number;            // 1–6, drives width
}

interface Puncture {          // the source of truth: every click is a puncture
  id: string;
  pos: Vec2;                  // snapped hole position
  dir: 'up' | 'down';         // needle coming up through fabric, or going down
}

interface ThreadRun {         // one continuous length of one thread
  id: string;
  threadId: string;
  stitchType: StitchType;
  punctures: Puncture[];
  tiedOff: boolean;
}

interface Piece {
  id: string;
  version: 1;
  fabric: FabricId;
  fabricColor: HSL;
  hoopDiameterMm: 100 | 150 | 200;
  threads: Thread[];
  runs: ThreadRun[];          // in creation order = stacking order
  activeThreadId: string | null;
  createdAt: string; updatedAt: string;
}
```

**Derived (never stored):** `Stitch[]` and `Knot[]` are computed from runs by the stitch engine:

```ts
interface Stitch { runId: string; threadId: string; a: Vec2; b: Vec2; side: 'front' | 'back'; seed: number; order: number }
interface Knot   { runId: string; threadId: string; pos: Vec2; seed: number; order: number }
```

Because stitches reference threads by id, **editing a thread's color or material recolors every stitch made with it**. That's intended.

---

## 5. Stitch engine (pure logic, `src/model/stitchEngine.ts`)

### 5.1 Holes and snapping (`src/model/holes.ts`)

Each fabric defines a hole lattice. The crosshair snaps to the nearest hole.

| Fabric | Look | Hole lattice |
|---|---|---|
| `cotton` (artist canvas / calico) | tight plain weave, matte | square grid, 0.9 mm |
| `linen` | plain weave with slubs (thick/thin yarn) | square grid, 1.25 mm |
| `aida14` | open block weave with visible holes | square grid, 25.4/14 = **1.814 mm**, holes visibly rendered |
| `felt` (wool felt) | no weave, fibrous | free placement, quantised to 0.3 mm |

Snapping priority:
1. **Existing holes** within `tuning.existingHoleMagnet × spacing` (sharing holes is how back and satin stitch work).
2. Otherwise nearest lattice hole within `tuning.snapRadius × spacing`.
3. Points outside the hoop's inner radius (minus 3 mm margin) are invalid.

### 5.2 Needle state machine

Each run tracks where the needle is: `front` (needle is above the fabric, thread comes from the last hole) or `back`.

- **Starting a run:** first click = needle comes **up** at that hole. No stitch yet.
- **Running & Satin:** clicks alternate **down / up**.
  - down → creates a **front** stitch from the previous hole to this hole (visible).
  - up → creates a **back** travel from previous hole to this hole (hidden in MVP; stored for a future back view).
- **Back stitch (continuous line):** after the first up, **every click creates a visible front stitch** from the previous hole. (Real back stitch comes up ahead and goes back into the previous hole; we model the visible result.) Store the implied back travel too.
- **French knot:** each click creates a knot at that hole (needle up and down in place). The needle ends on the back.
- **Satin helper:** after a satin front stitch A→B, show a faint ghost ring at the suggested next "up" hole: one lattice step from A, perpendicular to A→B, on the side the user has been progressing. Purely a hint; any hole works.

### 5.3 Stitch length limits

- Over `tuning.softMaxStitchMm` (12 mm): allowed, but the guideline renders **slack** (slight wave, dimmer) as a gentle "this will snag" cue.
- Over `tuning.hardMaxStitchMm` (25 mm): click is refused with a small "tug" animation on the guideline. No error dialogs.

### 5.4 Runs and thread switching

- Each thread has at most one **open run** (not tied off). Switching to a thread **resumes its open run** from its last hole, so the guideline starts there.
- **Tie off** (button or `T`, or double-click on the fabric) closes the current run. The next click starts a new run (needle comes up).
- Changing stitch type mid-run ties off the current run and starts a new one on the next click.
- Picking up a thread that has an open run also restores that run's stitch type in the tray.

### 5.5 History

Global undo/redo over punctures and run/thread operations, in the order they happened (`Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`). Undoing a puncture removes it (and any stitch/knot it created). Undo is presented as **unpicking** (section 7.5).

### 5.6 Tests (vitest)

- Each stitch type: given a click sequence, the derived stitches (count, sides, endpoints) are correct.
- Thread switch → resume from last hole; tie-off → new run starts with an up.
- Snapping: lattice, existing-hole magnet, out-of-hoop rejection, felt quantisation.
- Length limits.
- Undo/redo round-trips (state after undo+redo equals before).

---

## 6. Rendering — the hoop view (`src/render/hoop/`)

### 6.1 Scene

- `OrthographicCamera` looking straight down at the hoop. Hoop default 150 mm diameter.
- Background: warm, softly vignetted tabletop colour (flat is fine), so the hoop is the only lit object.
- Hoop: a wooden ring (two concentric rings, simple wood-grain shader or texture) slightly above the fabric with a soft shadow inward.
- Fabric: a disc clipped to the hoop's inner radius, using a **custom `ShaderMaterial`**.
- **One shared lighting GLSL chunk** (`shaders/common/lighting.glsl`) used by both fabric and thread shaders so they always match:
  - **Ambient:** soft, slightly warm fill (`uAmbientColor`, `uAmbientIntensity`).
  - **Key light:** a low-angle directional "window" light from the upper-left (`uKeyDir`, elevation ~25°). Grazing light is what reveals weave and raised stitches.
  - **Focus lamp:** a soft spotlight in hoop space (`uLampPos` xy in mm + height, `uLampRadius`, `uLampIntensity`). It follows the camera's focus centre (not the cursor). When zoomed in it narrows and the hoop edges dim slightly; in overview it widens and evens out.
- Colour pipeline: HSL → linear sRGB for shading → sRGB output (`THREE.SRGBColorSpace`, tone mapping off or neutral).

### 6.2 Fabric shader (procedural, resolution-independent)

Compute a **height field** in the fragment shader, derive normals with finite differences, then light it.

- **Plain weave (cotton, linen):** `uv = posMm * threadsPerMm`; cell = `floor(uv)`; warp is on top where `(cell.x + cell.y) mod 2 == 0`. Each yarn is a cylinder cross-section: height = `sqrt(1 - (2·fract - 1)²)`, modulated along its length so it dips where it goes under. Add value-noise variation in yarn thickness and colour (±2–3% lightness).
- **Linen:** same, plus **slubs**: low-frequency noise that thickens/thins yarns along their length, and slightly stronger colour variation.
- **Aida 14:** threads grouped into blocks with **dark, visible holes** at the lattice points (these are the stitch holes; they must line up exactly with `holes.ts`).
- **Felt:** no weave. Layered fBm noise plus short directional fibre streaks at random angles; matte; slight fuzz.
- **Hole dimples:** every used hole gets a tiny darkened dimple (contact shadow) where thread enters. Render as small instanced soft dots under stitches.
- **Anti-aliasing:** fade weave detail with `fwidth` so zooming out never shimmers or moirés.

Starting parameters (tune in M1, keep in `tuning.ts`):

| Fabric | threads/mm | default colour (HSL) | notes |
|---|---|---|---|
| cotton | 2.2 | 40, 25, 88 | fine, tight, matte |
| linen | 1.6 | 38, 22, 78 | slub amount 0.35 |
| aida14 | 4 threads per 1.814 mm block | 45, 15, 95 | hole size ~0.45 mm |
| felt | n/a | 20, 30, 45 | fibre scale ~0.2 mm |

### 6.3 Thread shader (the most important visual)

Render all stitches as **one `InstancedMesh` of a unit quad**. Per-instance attributes: `a`, `b` (mm), `width` (mm), `color` (linear RGB), material params, `seed`, `order`.

**Vertex shader:** build a quad along `a→b`, width = thread width + fuzz margin. Slightly inset the ends so the thread appears to dive into the hole.

**Fragment shader**, in layers:

1. **Roundness:** across-width coordinate `v ∈ [-1, 1]` → cylinder normal `(v, sqrt(1 - v²))` in the stitch's local frame. Diffuse lighting from ambient + key + lamp.
2. **Twist:** diagonal stripes along the length: `fract(u · twistPerMm + v · twistSlope)`. Darken the grooves between plies. Number of plies per material (below).
3. **Fibre:** high-frequency noise stretched along the thread for fibrous texture; a soft **fuzz halo** beyond the core width (alpha falloff) for stray fibres.
4. **Sheen:** **Kajiya-Kay** anisotropic specular using the thread tangent (`normalize(b - a)`), from key light and lamp. This is what makes satin fills shimmer as the light changes.
5. **Ends:** darken and taper the last ~0.3 mm at each end (ambient occlusion where thread enters fabric).
6. **Imperfection:** deterministic per-stitch jitter from `seed`: width ±8%, lightness ±3% (applied in OKLCH so all hues jitter evenly), endpoints ±0.08 mm.
7. **Anti-aliasing:** fade twist/fibre detail with `fwidth` at low zoom.

**Shadows:** before the stitches, draw a **shadow instance pass**: the same quads offset along the key light direction by ~0.3 mm, blurred (soft alpha falloff), multiplied onto the fabric at ~25% opacity.

**Stacking:** draw in `order` (creation order). Later stitches sit on top. Use painter's order (depth test off for stitches) rather than z-fighting.

**French knots:** instanced round impostors (~1.2× thread width × 2.5) with a swirled normal pattern, same lighting and sheen, plus a contact shadow.

Starting values per material (tune in M1):

| Material | width per strand (mm) | default strands | plies | twist /mm | sheen | spec exponent | fuzz |
|---|---|---|---|---|---|---|---|
| floss (stranded cotton) | 0.3 | 2 | 6 | 0.6 | 0.35 | 30 | 0.15 |
| perle | 0.45 | 2 | 2 | 1.2 | 0.6 | 60 | 0.05 |
| silk | 0.25 | 2 | 1 | 0.2 | 0.9 | 120 | 0.02 |
| wool (crewel) | 0.55 | 2 | 2 | 0.5 | 0.1 | 10 | 0.45 |

The **same stitch shader** must support three output modes via a uniform: `lit` (hoop view), `albedo` and `normal` (used for baking mockup textures, section 9).

### 6.4 Performance

- Target **60 fps with 20,000 stitches** on a recent laptop (e.g. M1 MacBook Air, integrated GPU).
- Grow instance buffers by doubling; update only changed ranges.
- Re-derive stitches incrementally (on new puncture, append; on undo, pop).

---

## 7. Interaction — stitching (`src/interaction/`)

The feel should be **calm, precise and unhurried**. Nothing moves under the cursor while the user is aiming.

### 7.1 Camera states (`cameraDirector.ts`)

| State | What the user sees | How you get there |
|---|---|---|
| **Overview** | Whole hoop with margin, lamp wide and even | App start; `Esc`; idle timeout |
| **Focus** | ~3× zoom on the working area, lamp narrowed, edges slightly dimmed | Click anywhere on the hoop in Overview |
| **Manual** | User-controlled pan/zoom | Scroll/pinch to zoom, `Space`+drag or middle-drag to pan |

Rules:
- In **Overview, a click selects where to work** (glide into Focus centred there). It does **not** make a hole. If a run is open, centre on its last hole instead.
- Glide in: `tuning.glideInMs` (1400 ms), ease-in-out sine. Glide out: `tuning.glideOutMs` (1600 ms).
- **The camera never moves while the user is aiming.** Recentring happens only **after a stitch's pull-through animation finishes**, and only if the last hole is within the outer `tuning.recentreEdge` (22%) of the viewport. Recentre over `tuning.recentreMs` (900 ms).
- **Step back:** after `tuning.idleStepBackMs` (8 s) with no pointer movement, ease out to Overview ("hold the hoop at arm's length"). `Esc` does it immediately. Make the idle step-back a toggle in settings (default on).
- Zoom limits: fit-to-hoop … 8×. Trackpad pinch arrives as `wheel` with `ctrlKey`; handle it.
- **Reduced motion** (`prefers-reduced-motion`): replace all glides with a 150 ms crossfade/cut.
- The **lamp** eases with the camera: centre = camera focus; radius and intensity interpolate between Overview and Focus values.

### 7.2 Crosshair cursor

- Hide the system cursor over the hoop. Draw a thin crosshair at the pointer (screen-space overlay) plus a **ring snapped to the target hole** (hoop space, so it sits exactly on the hole).
- Ring states: normal (valid hole), magnet (snapping to an existing hole: ring slightly thicker), invalid (outside hoop: muted, crosshair only).
- Satin helper ghost ring (section 5.2) shown at 30% opacity.

### 7.3 Guideline (preview thread)

From the run's last hole to the snapped target hole, render a **preview stitch using the real thread shader**:
- Next click makes a **front** stitch → solid preview at ~55% opacity.
- Next click is a **back** travel → faint **dotted** line (not thread-shaded), ~30% opacity.
- Over the soft max → slack (gentle sine wave, dimmer). Over the hard max → slack, and a click makes the guideline do a small tug wiggle instead of stitching (no red, no error text).
- No open run → no guideline; the ring alone shows where the needle will come up.

### 7.4 Puncture and pull-through

On click:
1. A tiny **dimple** appears at the hole (fade in 120 ms).
2. If a front stitch is created: **pull-through** animation over `tuning.pullThroughMs` (380 ms, ease-out cubic). The thread draws from the previous hole to the new one while its width settles from 1.15× to 1×.
3. Knot: scales from 0.6× to 1× with a slight overshoot (220 ms).
4. Only after the animation ends may the camera recentre (7.1).

### 7.5 Undo as unpicking

Undoing a front stitch: the thread retracts toward its start hole and fades (200 ms); the dimple fades if no other stitch uses the hole. Redo replays the pull-through.

### 7.6 Keyboard shortcuts

| Key | Action |
|---|---|
| `1`–`9` | Pick up thread 1–9 from the rack |
| `R` / `B` / `S` / `K` | Running / Back / Satin / Knot |
| `T` | Tie off current run |
| `Esc` | Step back to Overview |
| `Space` + drag | Pan |
| `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z` | Undo / redo |
| `Alt`+click on a stitch | Pick up that stitch's thread |
| `?` | Show shortcut sheet |

### 7.7 First-run hint

On an empty hoop, show a small soft card: "Click to choose where to stitch · Click again to make a hole · Esc to step back." It disappears after the first stitch and never returns.

---

## 8. Threads, colour and fabric UI (`src/ui/`)

Visual tone: quiet, warm, few controls on screen. Panels are small and float over the canvas edges. Nothing modal while stitching except the thread picker.

### 8.1 Thread rack (left edge)

- A vertical rack of **needles**, one per thread in the piece. Each shows a small **wound-skein swatch** rendered with the actual thread shader (a tiny offscreen render, cached), so silk looks shiny and wool looks fuzzy before you pick it.
- Active needle is raised/highlighted; number badges 1–9.
- Clicking a needle picks it up. If that thread has an open run, the guideline resumes from its last hole.
- **Long-press (500 ms) or Alt+click on any stitch** in the hoop picks up that stitch's thread (eyedropper that stays in character). Hit-test = distance from point to segment ≤ half width.
- A short **re-threading animation** (≤ 600 ms) on switch: the needle chip glints, the swatch slides in. Must never block the next click.
- `+` at the bottom opens the thread picker to add a new thread.
- Right-click / `…` on a needle: edit thread (opens picker), rename, remove (only if unused, or confirm "This will unpick N stitches").

### 8.2 Thread picker (HSL)

- **Hue ring** (wheel) + **Saturation** and **Lightness** sliders. Each slider track shows the gradient it produces and re-tints live as hue changes. Show numeric H/S/L values (editable inputs).
- **Lightness nudge row:** 5 swatches of the current colour from darker to lighter (computed in OKLCH so steps look even across hues). Helpful for shading.
- **Material** segmented control: Floss · Perle · Silk · Wool.
- **Strands** slider 1–6 (thickness).
- **Live preview:** a small satin swatch rendered with the real thread shader under the hoop's current lighting, with the light slowly sweeping so sheen is visible.
- Buttons: "Thread needle" (adds + selects), Cancel.

### 8.3 Stitch tray (bottom centre)

Four tools drawn as objects (needle icons), each with a **tiny rendered stitch sample** (pre-rendered images are fine for MVP): Running · Back · Satin · French knot. Selected tool rises slightly. Hover shows name + shortcut.

### 8.4 New piece dialog

Choose **fabric** (4 tiles with a live fabric swatch), **fabric colour** (preset swatches + HSL), **hoop size** (100 / 150 / 200 mm). Opened from "New piece" in the top-bar menu. The current piece is already autosaved (8.6), so no confirmation is needed.

### 8.5 Top bar (minimal)

Piece name (editable) · Undo/Redo · Tie off · Step back · **See it on…** (goes to Mockup) · menu (New piece, Open recent, Export PNG, Export/Import JSON, Settings: idle step-back on/off, reduced motion override).

### 8.6 Persistence & export

- Autosave each `Piece` to `localStorage` under its id on every change (debounced 500 ms), keeping the 10 most recent for "Open recent". Wrap all storage calls in try/catch; the app must work if storage is unavailable.
- Export/Import `.hoop.json`.
- Export PNG of the hoop view at 2× (and 4× option), rendered offscreen at fixed Overview framing.

---

## 9. Mockup view (`src/render/mockup/`)

The piece is re-rendered onto 3D products, not pasted as a flat picture.

### 9.1 Baking the embroidery

When the user opens Mockup, bake the stitches (no fabric, no hoop) into textures with an offscreen orthographic render of the stitch `InstancedMesh`, using the stitch shader's output modes:

- **Albedo + alpha** (2048², covering the bounding box of all stitches + 2 mm padding): thread colour with twist/fibre detail, alpha = thread coverage incl. soft fuzz.
- **Normal map** (same size): tangent-space normals from the cylinder + twist + fibre layers.
- **Roughness** per material can be a uniform per bake region or a third texture (floss 0.6, perle 0.4, silk 0.25, wool 0.85).
- Record the physical size of the baked area in mm so the decal is placed at true size.

### 9.2 Scene

- `PerspectiveCamera` + `OrbitControls` (no pan; polar angle clamped so you can't look from underneath; slow auto-rotate after 6 s idle; stops on interaction).
- Lighting: a studio **HDRI environment stored locally** in `public/hdri/` (a CC0 studio HDRI from Poly Haven, ~1–2K is enough; do not rely on runtime CDN presets) + one soft key light + drei `ContactShadows` on a neutral floor.
- Product base material: `MeshStandardMaterial` with a **procedural fabric texture baked from our fabric shader** (render the fabric shader into albedo/normal render targets once per product fabric). For meshes without UVs, use **triplanar mapping** (custom shader chunk via `onBeforeCompile`) so imported models still get fabric texture.
- Embroidery: drei **`<Decal>`** projected onto the product mesh, using the baked albedo (alpha-blended), normal map and roughness, `polygonOffset` to avoid z-fighting. Decal projection means **models don't need clean UVs**. Exception: the supplied T-shirt has real-size pattern UVs, so it uses pattern-space placement instead (9.3.1).

### 9.3 Products (`products.ts` config)

All products are modelled or normalised to real-world size in mm.

| Product | Source | Size | Default placement zones |
|---|---|---|---|
| **Notebook** (A5, cloth-bound) | **Procedural** (no asset): rounded box cover, slightly inset cream page block with fine page-edge stripes, visible spine | 148 × 210 × 15 mm | front centre, front lower-right corner |
| **Tote bag** | **Procedural** (no asset): thin box with a gently puffed front panel (low-frequency displacement), soft bottom gusset, two handles as `TubeGeometry` along curves | 380 × 420 mm body | front centre, front upper-left |
| **T-shirt** | **Supplied GLB**: `public/models/tshirt.glb` (the owner's `t_shirt.glb`; details in 9.3.1) | ~700 mm tall | chest centre, left chest, upper back |

Each product config entry: `id`, `name`, `source` (`procedural` | `glb` path), `fabric` (for base material: tote = heavy cotton canvas, notebook = linen book-cloth, T-shirt = fine cotton jersey look via the cotton shader at higher thread density), `defaultColor` (HSL), `zones[]` (`{ id, label, position, normal, defaultWidthMm }`).

The owner wants every product except the T-shirt **generated in code** (procedural geometry), not modelled by hand. Keep it that way for future products too (e.g. cushion, pouch, cap) unless the owner supplies a file.

### 9.3.1 The supplied T-shirt model (inspected)

- **Source and licence:** "T Shirt" by funlab117 on Sketchfab, **CC-BY-4.0**. The app **must show a credit**, e.g. in the mockup panel footer: `T-shirt model: "T Shirt" by funlab117 (Sketchfab), CC BY 4.0`.
- **Size:** 6.8 MB, 10 meshes, ~238k triangles, no textures, 2 plain materials (body, sleeves). Replace both with our fabric material.
- **Structure:** each body panel is **double-layered**: an outer face, an inner face ~0.5 mm behind it, and an edge strip. Front panel: `Object_10` = outer (normals face out), `Object_11` = inner, `Object_12` = edge. The back panel follows the same pattern (`Object_14/15/16`; confirm which is outer by checking normals). Sleeves: `Object_18`, `Object_20`. Collar ribbing: `Object_6`, `Object_8`.
- **Orientation:** the mesh data is already **Y-up, front = +Z, in metres** (hem at y≈0.94, collar at y≈1.64). The file's root nodes `Sketchfab_model` and `GLTF_SceneRootNode` add a ~29° display rotation; **reset both to identity on load**. Scale ×1000 for our mm world.
- **UVs are real-size sewing-pattern coordinates in millimetres** (typical of CLO/Marvelous Designer exports). Front panel: u ≈ −256…256, v ≈ −406…297, and **v grows downward**. Mid-chest ≈ `(u 0, v −182)`, which is y≈1.43 m on the model.
- **Use pattern-space placement for this model, not a projected decal.** Take the outer front mesh's triangles whose UVs overlap the embroidery square (+3 mm margin), clone them into a patch mesh, and render the baked albedo/normal/anisotropy maps on it with:
  - `repeat = (1/size, −1/size)`
  - `offset = (−(cx − size/2)/size, (cy + size/2)/size)`
  - `ClampToEdge` wrapping, transparent, `depthWrite: false`, `polygonOffset`.
  This is how real garment embroidery works (stitched on the flat panel before sewing), and it follows every fold with no projection stretching. Keep `<Decal>` for imported models that don't have mm UVs.
- **Fabric texture:** because UVs are in mm, a jersey-knit normal map tiles at true scale (`repeat = 1 / tileSizeMm`).
- **Performance:** fine on desktop as is. Optional cleanup: weld + simplify to ~100k triangles with `gltf-transform`, then re-check the folds and the inner/outer layers for poke-through before adopting it.
- **Working reference:** `reference/tshirt-preview/` contains a prototype (three.js, no React) that does all of the above: model reset, knit texture, embroidery bake, pattern-space patch, studio lighting. Use it as a guide for M6, not as production code.

### 9.4 Mockup panel (right side)

- Product picker: three cards (Notebook / Tote / T-shirt) + **Import model**.
- **Product colour**: a row of preset swatches + HSL picker (reuse 8.2 without material/strands).
- **Placement**: zone chips; **size** slider (mm, shows true width); **rotation** slider (−45°…45°). Optional (if cheap): drag the decal on the surface via raycast.
- **Export PNG** at 2× of the current view.
- "Back to hoop" returns to Stitch with the camera where it was.

### 9.5 Import model (e.g. from Womp)

This is how the owner brings in their own models.

- Accept **`.glb`, `.gltf`, `.obj`** (and `.stl` as a fallback; STL has no colour or materials, which is fine because we apply our own fabric material).
- On load: compute bounding box → centre it → scale so its largest dimension matches a user-chosen real size (default 300 mm, editable) → offer "Rotate 90°" buttons for X/Y/Z in case its up-axis differs.
- Apply our fabric base material (triplanar, so **no UVs required**). Let the user pick which fabric the product is made of.
- **Place the decal by clicking on the model**: raycast gives point + surface normal → decal position/orientation. Then size/rotation sliders as in 9.4.
- If the mesh is very dense (> 150k triangles), warn that it may be slow and suggest exporting a lighter version. Optionally simplify on import with `meshoptimizer` (stretch).
- Imported models are kept for the session (in-memory); persisting them is out of scope.

**Notes for the owner on Womp exports** (verify in Womp's export dialog, these may have changed):
- A 2024 review of Womp's beta said the free plan exports **STL and OBJ**, with more formats (glTF, FBX, USD…) on Pro. Our importer handles OBJ and STL, so the free plan is enough.
- Womp lets you choose triangle density on export; keep it modest (roughly 20k–80k triangles) for smooth orbiting in the browser.
- Womp is best for soft, rounded objects (pouches, cushions, plush shapes, rounded notebooks). A thin, draped T-shirt is easier to get from a downloaded model.

---

## 10. Tunables (`src/tuning.ts`)

Every number that affects feel lives here, with a comment. Starting values:

```ts
export const tuning = {
  // camera
  focusZoom: 3,
  maxZoom: 8,
  glideInMs: 1400,
  glideOutMs: 1600,
  recentreEdge: 0.22,        // fraction of viewport
  recentreMs: 900,
  idleStepBackMs: 8000,
  reducedMotionCutMs: 150,

  // stitching
  pullThroughMs: 380,
  knotPopMs: 220,
  unpickMs: 200,
  softMaxStitchMm: 12,
  hardMaxStitchMm: 25,
  snapRadius: 1.2,           // × hole spacing
  existingHoleMagnet: 1.6,   // × hole spacing
  longPressMs: 500,
  rethreadMs: 600,

  // guideline
  guideFrontOpacity: 0.55,
  guideBackOpacity: 0.3,

  // lighting
  keyElevationDeg: 25,
  keyAzimuthDeg: 135,        // from upper-left
  lampRadiusFocusMm: 45,
  lampRadiusOverviewMm: 140,
  edgeDimFocus: 0.15,        // how much hoop edges dim in Focus

  // shading
  stitchShadowOffsetMm: 0.3,
  stitchShadowOpacity: 0.25,
  jitterWidth: 0.08,
  jitterLightness: 0.03,
  jitterEndpointMm: 0.08,
} as const;
```

Fabric and thread material parameters (tables in 6.2 and 6.3) also live in `tuning.ts` as `fabrics` and `threadMaterials` maps.

---

## 11. Milestones and acceptance checks

### M0 — Project setup
- Vite + React + TS strict, R3F, drei, zustand, culori, leva (dev only), vitest, Playwright, ESLint + Prettier.
- Orthographic hoop scene with a placeholder fabric disc; 1 unit = 1 mm; hoop fits viewport with margin; resizes correctly.
- **Accept:** `npm run dev`, `npm test`, `npm run build` all pass; WebGL2 fallback message works.

### M1 — Look test (STOP for review)
- Shared lighting chunk (ambient + key + lamp). Dev panel (leva) to move key light and lamp, change zoom.
- All 4 fabric shaders. Thread shader with all layers (6.3) for all 4 materials, stitch shadows, knots.
- A hard-coded demo piece: a satin block, a back-stitch curve, a running-stitch line and 5 knots, in each material.
- **Accept:** Playwright screenshots at 1×, 3×, 8× zoom for each fabric, plus a lamp sweep (3 positions) showing silk shimmer changing. Threads read as round and twisted, not flat lines. Silk is clearly shinier than wool; wool clearly fuzzier. No shimmer/moiré when zooming. 60 fps with 20k random stitches.

### M2 — Stitch engine
- `holes.ts`, `stitchEngine.ts`, history module, all pure + tested (5.6).
- **Accept:** all tests pass; the reference tree scenario can be expressed as a test (click sequences → expected stitches).

### M3 — Stitching interaction (STOP for review)
- Camera director (7.1), crosshair + ring (7.2), guideline (7.3), puncture/pull-through/dimple (7.4), unpicking (7.5), shortcuts (7.6), first-run hint (7.7). One default thread is enough here.
- **Accept (manual QA script):**
  1. Overview click glides in; no hole is made.
  2. While moving the mouse to aim, the camera never moves.
  3. Stitch near the right edge → after the pull-through finishes, the view drifts to recentre.
  4. Leave it idle 8 s → steps back to Overview. `Esc` does the same instantly.
  5. Running stitch alternates solid/dotted guideline; back stitch is always solid.
  6. A 15 mm stitch shows a slack guideline; a 30 mm stitch is refused with a tug.
  7. Undo unpicks visibly; redo re-stitches.
  8. With reduced motion on, there are no glides.
  9. Record a short screen video of stitching a small shape for review.

### M4 — Threads, colour, fabrics
- Thread rack, thread picker (HSL + nudge row + material + strands + live preview), stitch tray, eyedropper pickup, thread edit recolors stitches, new-piece dialog with all fabrics and hoop sizes.
- **Accept:** the reference tree scenario (section 1) works end to end by hand, including switching back to brown and resuming from the last hole.

### M5 — Persistence and export
- Autosave, JSON export/import, PNG export 2×/4×.
- **Accept:** reload restores the piece exactly; exported JSON re-imports identically; works with storage blocked (no crash, just no autosave).

### M6 — Mockups
- Bake (9.1), scene (9.2), notebook + tote procedural products, T-shirt GLB slot with placeholder, mockup panel (9.4), import model (9.5).
- **Accept:** the tree piece appears at true size on the T-shirt (pattern-space, with the CC-BY credit shown), notebook and tote; stitches still look raised (normal map) when orbiting; product colour and placement work; importing an OBJ with no UVs shows fabric texture and accepts a click-placed decal; PNG export works.

### M7 — Polish (stretch)
- Soft synthesized sounds via WebAudio (no audio files): puncture "thup", thread-pull whisper, tie-off. On by default at low volume, with a one-click mute in the top bar.
- Idle-timing and easing tuning pass with the owner.
- Mockup auto-rotate and a gentle "reveal" when switching products.

---

## 12. Project structure

```
src/
  main.tsx, App.tsx              # routes/screens: Stitch, Mockup
  tuning.ts
  model/                         # pure TS, no React/three
    types.ts  piece.ts  holes.ts  stitchEngine.ts  history.ts  color.ts
  state/
    store.ts                     # zustand: piece, active tool, active thread, UI state
  interaction/
    cameraDirector.ts  pointer.ts  shortcuts.ts
  render/
    shaders/common/lighting.glsl
    shaders/fabric.frag  stitch.vert  stitch.frag  knot.frag
    hoop/  HoopScene.tsx  Fabric.tsx  Stitches.tsx  StitchShadows.tsx  Knots.tsx
           Guideline.tsx  Crosshair.tsx  Dimples.tsx  Lamp.ts
    bake/  bakeStitches.ts  bakeFabric.ts
    mockup/ MockupScene.tsx  products.ts  EmbroideryDecal.tsx  ImportedModel.tsx
            procedural/Notebook.tsx  procedural/Tote.tsx  triplanar.ts
  ui/
    ThreadRack.tsx  ThreadPicker.tsx  StitchTray.tsx  TopBar.tsx
    NewPieceDialog.tsx  MockupPanel.tsx  HintCard.tsx
  audio/ sfx.ts                  # M7
reference/
  tshirt-preview/                # owner-supplied prototype for M6 (read-only guide)
public/
  models/   (tshirt.glb supplied by owner)
  hdri/     (studio HDRI, CC0)
tests/
  holes.test.ts  stitchEngine.test.ts  history.test.ts  color.test.ts
e2e/
  screenshots.spec.ts            # M1/M3 review screenshots
```

**Quality bar:** desktop Chrome, Safari and Firefox (current versions); keyboard-accessible UI with visible focus; all panels labelled for screen readers; colour inputs show numeric HSL; respects `prefers-reduced-motion`; no console errors.

---

## 13. Roadmap after the MVP (do not build now)

1. Touch input: crosshair offset above the finger, pinch zoom, long-press eyedropper.
2. Flip the hoop: back-of-fabric view using the stored back travels and tie-off knots.
3. Time-lapse replay of a piece (punctures are already an ordered log).
4. More stitches: chain, stem, split, long-and-short, seed, couching, cross-stitch on Aida.
5. Variegated threads (hue drifts along the length) and metallic thread.
6. Ambience panel: named scenes that set lamp warmth + background sounds together.
7. Photo-based mockups (displacement onto product photos) and AI lifestyle scenes with the embroidery masked.
8. Guided patterns: a dot travels along a pattern path and the user stitches behind it.
9. Sharing links, accounts, a shared community hoop.
10. Export to machine embroidery formats; match colours to real floss numbers.

---

## 14. Decisions log

Decisions made with the owner after the original spec. Where they differ from the sections above, these win.

- **2026-11-23, M1:** Thread look starting values were tuned (see `src/tuning.ts`). Floss `plies` now means plies per strand (2), with the 2 strands visible side by side. Perle twist is 0.6/mm. Highlights use an eye tilted 22° toward the viewer. `threadExposure` keeps stitched colour true to its swatch.
- **2026-11-23, M2:** On woven fabrics the needle only passes through the gaps the weave leaves. Holes are on the gaps the fabric shader draws: cotton every gap between yarns (0.45 mm), linen every gap (0.625 mm), Aida the block-corner holes (1.814 mm). Felt keeps free placement quantised to 0.3 mm.
- **2026-11-23, M2:** The existing-hole magnet uses a bias (`existingHoleBias` × spacing), not a hard override. A used hole wins only when it is barely farther than the nearest free hole, so the next hole along stays reachable for satin.
- **2026-11-23, M2:** `Puncture` has a `seq` (global creation order), so stitches on a resumed run stack on top of stitches made in between.
- **2026-11-24, M3:** The lamp stays still over the hoop (one wide, even pool); the camera does all the moving. This replaces the lamp following and narrowing with the camera in 6.1 and 7.1.
- **2026-11-24, M3:** There are two tools in a FigJam-style toolbar at the bottom centre: **View** (H) to look around, and **Stitch** (R / B / S / K). The crosshair, hole ring and guideline appear only in Stitch mode while zoomed in. A click in Overview glides in, whichever tool is active. M4's stitch tray (8.3) becomes this toolbar.
- **2026-11-24, M3:** Moving around depends on the platform. On macOS a two-finger swipe pans, and pinch or ⌘ + scroll zooms. On Windows the wheel zooms, and Space + drag or middle-drag pans. Dragging with the View tool pans everywhere.
- **2026-11-24, M3:** Intent is kept separate from action. The crosshair, hole ring, satin ghost ring and guideline are interface, drawn in screen space and never as thread. Thread is rendered only once the user clicks the next hole (pull-through, dimple, knot pop). This replaces 7.3's "preview stitch using the real thread shader".
- **2026-11-24, M3:** A collapsible legend at the bottom left (toggled with `?`) replaces the shortcut sheet and the first-run card. It is open on the first visit with the hint line, folds after the first stitch, and is matched to the platform.
- **2026-11-24, M3:** Frames are drawn on demand (only while something moves), so an idle hoop costs nothing.
- **2026-11-24, product-first:** There is no automatic camera at all. Glide-in, recentring after a stitch and the idle step-back are gone; the user zooms and pans freely. The only camera move is **Fit** (button, Shift+1): a 450 ms glide, or an instant cut with reduced motion. `+` / `−` zoom about the centre, and a zoom control sits at the bottom right. Esc switches to the View tool. A click in Stitch mode makes a hole at any zoom. This replaces the earlier "a click in Overview glides in" entry and 7.1's focus / recentre / step-back behaviour.
- **2026-11-24, product-first:** The first screen is a 3D product (T-shirt, tote bag or notebook, switchable). You pick a hoop size (100 / 150 / 200) and drag it, or use presets, at true size on the product's millimetre pattern UVs. Colour swatches set the product and hoop fabric colour. **Start stitching** turns the camera to face the hoop, fades, and opens the hoop view. **← Product** goes back and shows the embroidery baked onto the product. Each product keeps its own piece, placement and hoop size; a hoop too big for a product steps down to the largest that fits (the notebook takes only 100 mm). This replaces part of M6.
- **2026-11-24, product-first:** On the product screen you can draw (pen, eraser) or upload a PNG, JPEG or SVG, then move, scale and turn it inside the hoop; it is clipped to the hoop circle. It is a **guide you stitch over**, like a washable transfer pen: traced on the hoop fabric with an opacity slider and show/hide, and not part of the stitched piece.
- **2026-11-24, product-first:** Fabric follows the product. The T-shirt is jersey knit (its own shader; holes 0.7 mm apart, between the loops), the tote is canvas (plain weave, 1 / 1.4 mm), and the notebook is linen book cloth.
- **2026-11-24, product-first:** Crowded holes: the ring turns dashed when a click would be the 4th pass through one hole, and the 6th is refused (`holeCrowdWarn` / `holeCrowdMax`).
- **2026-11-24, product-first:** The four plain-hoop fabrics (cotton, linen, Aida, felt) stay in the leva look panel only, for testing.
- **2026-11-24, product-first:** Models and lighting. The owner will supply GLB models for the tote and notebook (and maybe a new T-shirt) in `public/models/`, ideally with mm UVs, plus licence and credit info. Until then the tote and notebook are procedural stand-ins with mm UVs. The T-shirt credit shows at the bottom right whenever the T-shirt is on screen (later also in an About / Credits menu). Studio lighting uses three's `RoomEnvironment`, generated in code, with no HDRI download.
- **2026-11-24, models:** The tote and notebook are now the owner's Sketchfab models, both CC BY 4.0 and credited at the bottom right with a licence link. The tote is "Uploads_files_2167121\_ Tote Bag" by MoonOctopus, sized as a 380 mm wide bag; its front panel is its own mesh and becomes the embroidery panel with flat mm UVs, and its seams take a darker shade of the bag colour. The notebook is "PB153 Notebook Mid" by SCANIMAT, a photo scan in centimetres (130 × 203 mm), stood upright. Its leather cover becomes linen book cloth (so the swatches work) and the scanned page block stays as scanned; the front cover is the embroidery panel and takes the 100 mm hoop only. The procedural stand-ins are gone.
- **2026-11-24, one piece at a time:** A piece is one embroidery on one product: product, colour, hoop size and spot, design guide, and stitches. Once it has a stitch, the product is locked; picking another product asks to start a new piece (and to discard unsaved stitches). Colour and the hoop spot stay editable.
- **2026-11-24, Save & render:** The hoop view has a **Save & render** button at the top right. It asks "Finished stitching?", then ties off, takes the piece out of the hoop (no ring) and washes out the design guide, showing the finished product to turn and look at, with **Download image** (PNG at least 2× sharp) at the top right. The piece is saved to **Your pieces**, a shelf in the product panel kept in this browser (IndexedDB). Saved pieces can be reopened: **Keep stitching** puts the piece back in the hoop with the ring and guide, and saving again updates the same piece. **New piece** starts over. Work in progress isn't autosaved yet (M5).
- **2026-11-25, stitch guides:** Hovering (or keyboard-focusing) a stitch tool in the toolbar opens a card with a cross-section of that stitch, drawn like an instruction manual: a hatched fabric slab with holes, the thread over the front and under the back, numbered passes with up/down arrows, and a needle that follows the thread (still with reduced motion), plus a one-line description. Data in `ui/stitchGuide.ts`, drawing in `ui/StitchDiagram.tsx`.
- **2026-11-25, in/out chevrons:** The crosshair has four chevrons (north, east, south, west) that say what the next click does before you click. They point **in** and drift inward when the needle will go down into the fabric (finishing a stitch on top), and point **out** and drift outward when it will come up toward you (starting a run, or after a pass underneath). A French knot pulses out, then in. They are faint when the click would be refused, hold still with reduced motion, and are explained in the legend (`tuning.chevron*`).
- **2026-11-25, M4 threads:** A **thread rack** down the left edge of the hoop view: one skein per thread, numbered 1–9 (keys 1–9 pick them up). The thread on the needle sits out with a small needle across it; a dot marks a thread with an unfinished line, and picking it up carries on from its last hole with its stitch type. **⋯** (or right-click) edits, renames or removes a thread; removing a used thread asks first ("This will unpick N stitches") and can be undone; the last thread can't be removed. **+** adds one. Alt/Option+click, or press and hold for half a second, on a stitch picks up its thread (the eyedropper reaches a few screen pixels, so the gaps between satin rows count). The toolbar's thread swatch opens the picker for the thread on the needle. Short notes ("Picked up Leaf green") show above the toolbar. The Controls legend moved right of the rack.
- **2026-11-25, M4 picker in RGB:** The thread picker edits colour in **RGB**, not HSL (owner's call): R, G and B sliders whose tracks show the colours they'd make, number boxes, and a hex box. The shading row is 5 shades mixed toward black and white in RGB (no OKLCH). Picking a shade selects that swatch; the row stays made from the colour you picked (card, sliders or hex) and doesn't shift, the colour card keeps showing that colour, and the name follows it ("Light leaf green", "Deep navy"). It also has a **colour card** of 12 ready-made floss colours, material (Floss · Perle · Silk · Wool), strands 1–6, and a name that follows the colour ("Leaf green", numbered if taken) until you type one. Editing recolours that thread's stitches live in the hoop; Save is one undo step, Cancel puts them back. Threads still store HSL, so saved pieces are unchanged.
- **2026-11-25, M4 swatches:** Rack skeins and the picker's live preview are drawn with the real thread shader under the hoop's light (an offscreen render copied into a `<canvas>`, so no image URLs). The preview is an 8 mm satin patch at true size, so strands show, with the light sweeping slowly across it (still with reduced motion). A CSS swatch shows until it's drawn, or if it can't be.
- **2026-11-25, M4 dropped:** The New piece dialog (8.4) is not built: the product screen does that job, and the plain fabrics stay in the look panel. The rendered stitch samples in the tray (8.3) are not built: the toolbar icons and the cross-section hover cards do that job.
- **2026-11-25, onboarding:** On the first visit a **How it works** dialog opens over the product screen: four steps with pictures of a real piece (a tree on a tote bag): place the hoop, sketch your design, stitch it, see the finished piece. Back / Next, arrow keys, dots, Skip, Esc or × close it, and it's remembered in this browser. **How it works** under Start stitching opens it again. The pictures are `public/onboarding/*.jpg`, captured by `ONBOARDING_SHOTS=1 npx playwright test e2e/m4.spec.ts`.
- **2026-11-25, thread drawer:** The thread rack is a **drawer tucked off the left edge**. Closed, only the thread on the needle peeks out (half a skein at the edge). Hovering the left edge or the peeking skein slides it out; it tucks away 350 ms after the pointer leaves (`tuning.rackCloseDelayMs`), and stays out while its menu or the thread picker is open. Tab also opens it (Esc puts it away); on a touch screen, tapping the peeking skein opens it and tapping elsewhere closes it. The thread on the needle always sits **out of line**, shifted right so it pokes out past the drawer; the needle drawn across it is gone. ⋯ now sits on each skein's top-right corner and shows on hover. Nothing is clipped (the drawer's list has room for the shifted skein, and tooltips are drawn outside it). The Controls legend is back at the left edge; while closed the drawer sits under it.
