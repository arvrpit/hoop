# T-shirt embroidery preview (reference prototype)

A small three.js prototype that renders a procedurally stitched design onto the
supplied `t_shirt.glb`. It's a guide for milestone M6 in SPEC.md, not production code.

- `web/embroidery.js` builds the stitches into albedo, normal and anisotropy maps (mm space). It covers back, satin and running stitches plus French knots, with twist, fibre fuzz and contact shadow.
- `web/main.js` handles the rest:
  - resets the model's Sketchfab rotation
  - applies a jersey-knit material tiled in real mm
  - places the embroidery in the shirt's pattern-space UVs on the outer front panel (`Object_10`)
  - lights the scene with a studio environment and a key light

## Run

```bash
npm install three@0.170.0
cp /path/to/t_shirt.glb ./t_shirt.glb
python3 -m http.server 8765
# open http://localhost:8765/web/index.html?view=front&interactive
# views: front | three | close     shirt colour: &color=H,S,L  e.g. &color=212,26,60
```

`shoot.js` renders screenshots with Playwright: `node shoot.js '[{"query":"view=close","out":"close.png","dpr":2}]'`.

Model credit: "T Shirt" by funlab117 (Sketchfab), CC BY 4.0.
