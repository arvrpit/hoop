// Converts .glb models for the review page, whose host only serves a page its own files of plain
// types (no .glb, no data: or blob: URLs, no WebAssembly). Each model becomes:
//   name.gltf.json  — the glTF JSON, with the binary buffer as base64 text in buffers[0].extras.base64
//                     (src/render/product/modelLoader.ts packs it back into a .glb in memory)
//   name-<i>.png/.jpg — each embedded image as its own file, referenced by relative uri
// Usage: node scripts/glb-to-gltf.mjs a.glb [b.glb …]
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

for (const input of process.argv.slice(2)) convert(input);

function convert(input) {
  const glb = readFileSync(input);
  if (glb.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${input} is not a .glb`);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < glb.length) {
    const len = glb.readUInt32LE(off);
    const type = glb.readUInt32LE(off + 4);
    const data = glb.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  if (!json) throw new Error(`${input}: no JSON chunk`);
  const dir = dirname(input);
  const stem = basename(input).replace(/\.glb$/i, '');
  const files = [];
  (json.images ?? []).forEach((im, i) => {
    if (im.bufferView === undefined || !bin) return;
    const bv = json.bufferViews[im.bufferView];
    const ext = im.mimeType === 'image/png' ? 'png' : 'jpg';
    const name = `${stem}-${i}.${ext}`;
    writeFileSync(join(dir, name), bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength));
    json.images[i] = { ...(im.name ? { name: im.name } : {}), uri: name };
    files.push(name);
  });
  if (bin && json.buffers?.[0]) {
    delete json.buffers[0].uri;
    json.buffers[0].extras = { base64: bin.toString('base64') };
  }
  const out = join(dir, `${stem}.gltf.json`);
  const text = JSON.stringify(json);
  writeFileSync(out, text);
  console.log(`${out}: ${(text.length / 1e6).toFixed(1)} MB${files.length ? ` + ${files.join(', ')}` : ''}`);
}
