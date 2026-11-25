import { describe, expect, it } from 'vitest';
import { toGlb } from '../src/render/product/modelLoader';

describe('toGlb (review-page models)', () => {
  it('packs base64 buffer text back into .glb bytes', () => {
    const bytes = [1, 2, 3, 4, 5, 250];
    const json = {
      asset: { version: '2.0' },
      buffers: [{ byteLength: 6, extras: { base64: btoa(String.fromCharCode(...bytes)) } }],
    };
    const glb = toGlb(json);
    const v = new DataView(glb);
    expect(v.getUint32(0, true)).toBe(0x46546c67);
    expect(v.getUint32(8, true)).toBe(glb.byteLength);
    const jsonLen = v.getUint32(12, true);
    expect(jsonLen % 4).toBe(0);
    const text = new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen)).trim();
    const parsed = JSON.parse(text) as { buffers: { byteLength: number; extras?: unknown; uri?: string }[] };
    expect(parsed.buffers[0]).toEqual({ byteLength: 6 });
    const o = 20 + jsonLen;
    expect(v.getUint32(o + 4, true)).toBe(0x004e4942);
    expect([...new Uint8Array(glb, o + 8, 6)]).toEqual(bytes);
  });
});
