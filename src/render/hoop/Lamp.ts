// Focus lamp model. By decision (SPEC §14) the lamp stays still over the hoop and the camera does
// the moving. The look panel can still make it follow the camera (spec 6.1) for comparison.
import { tuning } from '../../tuning';
import type { HoopState } from '../../state/store';

export interface LampState {
  x: number;
  y: number;
  height: number;
  radius: number;
  intensity: number;
  edgeDim: number;
}

export function lampState(
  s: Pick<
    HoopState,
    'zoom' | 'focus' | 'lampFollowsCamera' | 'lampPos' | 'lampHeightMm' | 'lampIntensity' | 'lampRadiusMm'
  >,
): LampState {
  const t = s.lampFollowsCamera ? smooth01((s.zoom - 1) / (tuning.focusZoom - 1)) : 0;
  const centre = s.lampFollowsCamera ? s.focus : s.lampPos;
  return {
    x: centre.x,
    y: centre.y,
    height: s.lampHeightMm,
    radius: s.lampRadiusMm ?? lerp(tuning.lampRadiusOverviewMm, tuning.lampRadiusFocusMm, t),
    intensity: s.lampIntensity * lerp(1, 1.15, t),
    edgeDim: lerp(tuning.edgeDimOverview, tuning.edgeDimFocus, t),
  };
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
