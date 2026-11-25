// Look-test URL parameters, e.g. ?fabric=linen&zoom=3&fx=10&fy=5&lampx=20&lampy=0&demo=1&stress=20000&ui=0&rm=1
import type { FabricId } from '../model/types';
import type { HoopState } from './store';

const fabricIds: FabricId[] = ['cotton', 'linen', 'aida14', 'felt', 'jersey', 'canvas'];

export function readUrlOverrides(search: string): Partial<HoopState> {
  const q = new URLSearchParams(search);
  const out: Partial<HoopState> = {};
  const num = (k: string) => {
    const v = q.get(k);
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const fabric = q.get('fabric');
  if (fabric && (fabricIds as string[]).includes(fabric)) out.fabric = fabric as FabricId;
  const zoom = num('zoom');
  if (zoom !== undefined) out.zoom = zoom;
  const fx = num('fx');
  const fy = num('fy');
  if (fx !== undefined || fy !== undefined) out.focus = { x: fx ?? 0, y: fy ?? 0 };
  const lx = num('lampx');
  const ly = num('lampy');
  if (lx !== undefined || ly !== undefined) {
    out.lampFollowsCamera = false;
    out.lampPos = { x: lx ?? 0, y: ly ?? 0 };
  }
  const stress = num('stress');
  if (stress !== undefined) {
    out.source = 'stress';
    out.stressCount = Math.max(1, Math.round(stress));
  } else if (q.get('demo') === '1') {
    out.source = 'demo';
  } else if (q.get('blank') === '1' || fabric) {
    out.source = 'blank'; // look-test a plain hoop of the given fabric
  }
  if (q.get('rm') === '1') out.reducedMotion = 'on';
  if (q.get('always') === '1') out.alwaysRender = true;
  if (q.get('ui') === '0') out.hideUi = true;
  if (q.get('panel') === '0') out.hidePanel = true;
  if (q.get('shadows') === '0') out.shadows = false;
  return out;
}
