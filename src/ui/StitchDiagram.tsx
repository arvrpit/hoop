// A stitch drawn as a cross-section, like an instruction manual: the fabric slab (hatched), holes cut
// through it, the thread's path over the front and under the back, numbered passes with up/down
// arrows, and a needle that follows the thread (SVG animation; still with reduced motion).
import { useId } from 'react';
import type { StitchType } from '../model/types';
import { tuning } from '../tuning';
import { FABRIC_BOTTOM as B, FABRIC_TOP as T, stitchGuides } from './stitchGuide';

const NEEDLE = 'M0,0 L-30,-1.7 C-34,-1.9 -38,-1.9 -38,0 C-38,1.9 -34,1.9 -30,1.7 Z';
const HOLE_W = 5;
const W = 240;
const H = 116;

export function StitchDiagram({ type, animate }: { type: StitchType; animate: boolean }) {
  const g = stitchGuides[type];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const dur = `${tuning.stitchDiagramMs}ms`;
  const draw = '0;0.8;1'; // draw the thread over 80% of the loop, then hold
  const mid = (T + B) / 2;

  // Slab outline with gaps at the holes.
  const edges = (y: number) => {
    const xs = [...g.holes].sort((a, b) => a - b);
    let d = '';
    let x0 = 4;
    for (const h of xs) {
      d += `M${x0},${y}H${h - HOLE_W / 2}`;
      x0 = h + HOLE_W / 2;
    }
    return d + `M${x0},${y}H${W - 4}`;
  };

  return (
    <svg
      className="hoop-stitch-diagram"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`Cross-section of a ${g.label.toLowerCase()}`}
    >
      <defs>
        <pattern
          id={`hatch${uid}`}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ui-ink)" strokeOpacity="0.28" strokeWidth="1" />
        </pattern>
        <path id={`thread${uid}`} d={g.thread} />
      </defs>

      <text x="4" y="14" className="side">
        Front
      </text>
      <text x="4" y={H - 6} className="side">
        Back
      </text>

      {/* Fabric slab, hatched like a cutaway, with the holes cut through. */}
      <rect x="4" y={T} width={W - 8} height={B - T} fill="var(--ui-fabric)" />
      <rect x="4" y={T} width={W - 8} height={B - T} fill={`url(#hatch${uid})`} />
      {g.holes.map((x) => (
        <rect key={x} x={x - HOLE_W / 2} y={T - 0.5} width={HOLE_W} height={B - T + 1} fill="var(--ui-bg)" />
      ))}
      <path d={edges(T) + edges(B)} stroke="var(--ui-ink)" strokeWidth="1" fill="none" />

      {/* Thread: an earlier wrap (satin) faint behind, then the path being stitched. */}
      {g.ghost && <path d={g.ghost} className="thread ghost" />}
      <path d={g.thread} className="thread" pathLength={1} strokeDasharray={animate ? '1 1' : undefined}>
        {animate && (
          <animate
            attributeName="stroke-dashoffset"
            values="1;0;0"
            keyTimes={draw}
            dur={dur}
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Up / down arrows in the holes, and the order the needle passes through them. */}
      {g.passes.map((p) => (
        <path
          key={`a${p.x}`}
          className="way"
          d={p.way === 'up' ? `M${p.x},${mid - 3.5} l3,5 h-6 z` : `M${p.x},${mid + 3.5} l3,-5 h-6 z`}
        />
      ))}
      {g.passes.map((p) => {
        const w = 8 + p.n.length * 4.2;
        const y = g.numbers === 'below' ? B + 22 : T - 24;
        return (
          <g key={`n${p.x}`} className="num">
            <rect x={p.x - w / 2} y={y - 6.5} width={w} height="13" rx="6.5" />
            <text x={p.x} y={y + 3}>
              {p.n}
            </text>
          </g>
        );
      })}

      {/* The needle: rides along the thread, or (French knot) stands over hole 2 and plunges down. */}
      {g.needle === 'follow' ? (
        <g className="needle">
          <animateMotion
            dur={dur}
            repeatCount="indefinite"
            rotate="auto"
            keyPoints={animate ? '0;1;1' : '1;1;1'}
            keyTimes={draw}
            calcMode="linear"
          >
            <mpath href={`#thread${uid}`} />
          </animateMotion>
          <path d={NEEDLE} />
          <ellipse cx="-33" cy="0" rx="2.6" ry="0.75" className="eye" />
        </g>
      ) : (
        <g transform={`translate(${g.holes[1]},${T + 2})`}>
          <g className="needle">
            {animate && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,-10; 0,-10; 0,12; 0,12"
                keyTimes="0;0.6;0.82;1"
                dur={dur}
                repeatCount="indefinite"
              />
            )}
            <g transform={animate ? undefined : 'translate(0,-10)'}>
              <g transform="rotate(90) scale(1.35)">
                <path d={NEEDLE} />
                <ellipse cx="-33" cy="0" rx="2.6" ry="0.75" className="eye" />
              </g>
            </g>
          </g>
        </g>
      )}
    </svg>
  );
}
