// Each screen's scene keeps its own camera as the canvas's default while it is on screen.
// drei's makeDefault hands the camera back on unmount to whichever camera was default when it
// mounted; after a few product ⇄ hoop swaps that hand-back can be stale and leave the other
// screen's camera in charge (the finished view then drew nothing). This re-claims it.
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, type RefObject } from 'react';
import type * as THREE from 'three';

export function useOwnCamera(ref: RefObject<THREE.Camera | null>): void {
  const set = useThree((s) => s.set);
  const current = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const cam = ref.current;
    if (cam && current !== cam) set({ camera: cam as THREE.PerspectiveCamera });
  });
}
