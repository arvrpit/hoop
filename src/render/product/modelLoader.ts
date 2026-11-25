// Loads the product models. In the app they are plain .glb files. The review page lives on a
// locked-down host that only lets a page fetch its own files: no data: or blob: URLs, and no
// WebAssembly. There the models are `.gltf.json` files whose binary data is base64 text
// (`buffers[0].extras.base64`, made by scripts/glb-to-gltf.mjs) and whose images are separate files
// next to them. This loader turns such a file back into an in-memory .glb and parses it, so nothing
// needs a data: URL. (drei's useGLTF is not used: it starts a WebAssembly decoder we don't need.)
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

interface GltfJson {
  buffers?: { byteLength: number; uri?: string; extras?: { base64?: string } }[];
  [key: string]: unknown;
}

export class ProductModelLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void {
    if (!url.endsWith('.gltf.json')) return super.load(url, onLoad, onProgress, onError);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.json() as Promise<GltfJson>;
      })
      .then((json) => this.parse(toGlb(json), url.slice(0, url.lastIndexOf('/') + 1), onLoad, onError))
      .catch((e: unknown) => onError?.(e));
  }
}

/** A .gltf.json with its buffer as base64 text, packed back into .glb bytes. */
export function toGlb(json: GltfJson): ArrayBuffer {
  const buf = json.buffers?.[0];
  const bin = base64Bytes(buf?.extras?.base64 ?? '');
  const clean: GltfJson = { ...json };
  if (buf) {
    clean.buffers = [{ byteLength: bin.length }, ...(json.buffers ?? []).slice(1)];
  }
  const text = new TextEncoder().encode(JSON.stringify(clean));
  const jsonLen = pad4(text.length);
  const binLen = pad4(bin.length);
  const total = 12 + 8 + jsonLen + (bin.length ? 8 + binLen : 0);
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLen, true);
  view.setUint32(16, 0x4e4f534a, true); // JSON
  bytes.set(text, 20);
  bytes.fill(0x20, 20 + text.length, 20 + jsonLen); // JSON pads with spaces
  if (bin.length) {
    const o = 20 + jsonLen;
    view.setUint32(o, binLen, true);
    view.setUint32(o + 4, 0x004e4942, true); // BIN
    bytes.set(bin, o + 8);
  }
  return out;
}

const pad4 = (n: number) => (n + 3) & ~3;

function base64Bytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
