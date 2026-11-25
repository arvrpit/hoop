# Hoop

A calm embroidery canvas. See [SPEC.md](SPEC.md). M4 (threads and colour) and the first-visit onboarding are built, waiting for review before M5.

## Run it

```bash
npm install
npx playwright install chromium   # once, for screenshots
npm run dev                       # http://localhost:5183
```

**Using it:** the app opens on a **product** (T-shirt, tote bag or notebook; all three are CC BY 4.0 Sketchfab models,
credited at the bottom right). Pick a colour and a hoop size (100 / 150 /
200 mm), then drag the hoop or use a preset spot. Under **Design** you can draw with a pen, rub out, or upload a PNG, JPEG
or SVG and move, size and turn it; it's a guide you stitch over, like a washable transfer pen, and it's cut to the hoop.
On a first visit, **How it works** shows the four steps with pictures (reopen it under Start stitching).
**Start stitching** turns to face the hoop and opens the hoop view on that product's fabric (jersey, canvas or linen).

In the hoop view, pick a stitch in the bottom toolbar (R, B, S or K) and click holes; a click makes a hole at any zoom.
Hover a stitch tool to see a cross-section of what it does. The chevrons on the crosshair point **in** when the next
click sends the needle down into the fabric, and **out** when it brings it up toward you.
Threads live in a **drawer** on the left edge (only the thread on the needle peeks out; hover the edge to slide it
out): click one or press 1–9 to put it on the needle (a thread with an unfinished
line carries on from its last hole), **+** adds one, and **⋯** edits, renames or removes it. The picker works in RGB, with
a colour card of floss colours, darker/lighter shades, material and strands, and a live preview drawn with the real
thread shader. Option/Alt+click, or press and hold, on a stitch to pick up its thread; the toolbar swatch edits the
thread on the needle.
The camera never moves on its own: zoom with `+` / `−`, the zoom control (bottom right), pinch or the wheel, and press
**Fit** (Shift+1) to see the whole hoop. Esc switches to the View tool. The **Controls** legend (bottom left, `?`) lists
everything for your platform: on macOS a two-finger swipe pans and pinch zooms, and on Windows the wheel zooms and
Space + drag pans. **← Product** goes back and shows your stitches on the product.

You work on **one piece at a time**: once it has stitches, its product is fixed (picking another product starts a new
piece). When you're done, **Save & render** (top right of the hoop view) takes the piece out of the hoop, washes off
the guide and shows the finished product, with **Download image**. Saved pieces are listed under **Your pieces** in
the product panel (kept in this browser); open one to look at it, or **Keep stitching** to put it back in the hoop.

In dev (and the review build) there is also a **look panel** at the top right. It has fabric (including the four plain-hoop test fabrics),
piece (blank / demo / 20k-stitch stress), zoom presets, reduced motion, lights and every thread-material number. Drag its left edge to
resize it. "Copy tuning values" puts the thread numbers on your clipboard to paste into `src/tuning.ts`. The panel is
stripped from `npm run build`.

URL shortcuts: `?hoop=1` (open straight into the hoop view), `?demo=1&hoop=1` (the M1 demo piece),
`?fabric=linen&hoop=1&zoom=3&fx=10&fy=-5` (a plain hoop of that fabric, focus in mm), `?stress=20000&hoop=1`,
`&panel=0` (hide the look panel), `&ui=0` (hide all controls), `&rm=1` (reduced motion), `&always=1` (draw every frame).

## Tuning

Every number that affects look and feel is in **`src/tuning.ts`**, with comments: lighting, shading, the four fabrics
the six fabrics (four plain-hoop test fabrics plus jersey and canvas) and the four
thread materials. Save and the page reloads.

## Checks

| Command                                          | What it does                                                                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                       | unit tests (engine, holes, history, camera, colour, demo piece, product placement, saved pieces)                                                                            |
| `npm run lint` · `npm run build`                 | ESLint · type-check + production build                                                                                                                                      |
| `npm run shots`                                  | M1 review screenshots → `review/m1/` (every fabric at 1×/3×/8×, close-ups, lamp sweep, zoom sweep)                                                                          |
| `npx playwright test e2e/m3.spec.ts`             | M3 QA script (clicks never move the camera, + / − / Fit, Esc, guidelines, unpick, reduced motion, platforms, legend) + recording → `review/m3/`                             |
| `npx playwright test e2e/product.spec.ts`        | product flow: products, hoop size and spot, upload and pen, stitch, ← Product, product lock, Save & render, Download image, Keep stitching, Your pieces → `review/product/` |
| `npx playwright test e2e/m4.spec.ts`             | M4 reference tree on a tote: thread rack, RGB picker, back to brown from the last hole, French knots, eyedropper, edit/undo, rename, remove → `review/m4/` (add `ONBOARDING_SHOTS=1` to refresh `public/onboarding/`) |
| `npx playwright test e2e/onboarding.spec.ts`     | first-visit "How it works" steps, remembered, reopened from the product panel                                                                                               |
| `npx playwright test e2e/perf.spec.ts`           | 20k-stitch GPU frame time at 1×/3×/8×                                                                                                                                       |
| `npx playwright test e2e/webgl-fallback.spec.ts` | the "needs WebGL2" message                                                                                                                                                  |

Helpers: `node scripts/probe.mjs "<url>" out.png [x,y,w,h]` renders a URL and prints console errors;
`node scripts/contact.mjs out.png <cols> a.png b.png …` builds a contact sheet.

## How the look is built (M1)

- One shared lighting chunk (`src/render/shaders/common/lighting.glsl`): warm ambient, a low key "window" light
  from the upper left (the hoop ring shadows it near the rim), and a lamp that stays still over the hoop (one wide,
  even pool) while the camera moves. Highlights use an eye tilted 22° towards you, so sheen depends on stitch direction.
- Fabric is a per-pixel height field (plain weave, linen slubs, Aida blocks with holes on the stitch lattice, matted
  felt). Weave detail fades out as it gets smaller than a few pixels, so zooming doesn't shimmer.
- Threads (`common/thread.glsl`) are shared by stitches and French knots: rounded, slightly flattened strands lying
  side by side, helical ply twist, fibre streaks, stray-fibre fuzz, Kajiya-Kay sheen along the fibres, pinched dark
  ends where they dive into a hole. Shadows and hole dimples are drawn in a half-resolution pre-pass.
- Speed: a cheap depth pre-pass means only the top thread at each pixel runs the full thread shader.

## Dependencies beyond SPEC §3

`@vitejs/plugin-react` (Vite's React plugin), `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks` +
`eslint-plugin-react-refresh` + `globals` and `prettier` (M0 asks for ESLint + Prettier), `@types/*` (types only).
