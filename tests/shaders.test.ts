import { describe, expect, it } from 'vitest';
import { resolveIncludes } from '../src/render/shaders';

describe('shader includes', () => {
  it('inlines each chunk once and leaves three.js chunks alone', () => {
    const out = resolveIncludes(
      '#include "common/noise.glsl"\n#include "common/noise.glsl"\n#include <colorspace_fragment>',
    );
    expect(out.match(/uint pcg\(/g)).toHaveLength(1);
    expect(out).toContain('#include <colorspace_fragment>');
  });

  it('throws on unknown includes', () => {
    expect(() => resolveIncludes('#include "common/nope.glsl"')).toThrow(/nope/);
  });
});
