// A thread's swatch in the rack: a little wound skein drawn with the real thread shader (so silk
// shines and wool looks soft). Until that's drawn, or if it can't be, a plain CSS skein shows.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { hslToHex } from '../model/color';
import type { Thread } from '../model/types';
import { paintSwatch, whenSwatchesReady } from '../render/swatch/swatches';

const PX = 64; // drawn at 2× its 32 px size

export function Skein({ thread }: { thread: Pick<Thread, 'color' | 'material' | 'strands'> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const hex = hslToHex(thread.color);
  const { material, strands } = thread;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    return whenSwatchesReady(() =>
      setDrawn(paintSwatch(c, { color: thread.color, material, strands }, 'skein')),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hex stands for the colour
  }, [hex, material, strands]);
  return (
    <span
      className="hoop-skein"
      data-material={material}
      data-drawn={drawn || undefined}
      style={{ '--c': hex } as CSSProperties}
      aria-hidden
    >
      <canvas ref={canvas} width={PX} height={PX} />
    </span>
  );
}
