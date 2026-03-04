import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { PerspectiveCamera } from "three";
import { scrollState } from "./HeroScene";

interface CameraKeyframe {
  at: number;
  pos: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

const KEYFRAMES: CameraKeyframe[] = [
  { at: 0.0, pos: [0, 8, 30], lookAt: [0, 2, 0], fov: 55 },
  { at: 0.2, pos: [-2, 2.5, 4], lookAt: [-0.6, 1, 1.5], fov: 40 },
  { at: 0.4, pos: [4, 10, 5], lookAt: [5, 8, -3], fov: 50 },
  { at: 0.6, pos: [12, 5, 2], lookAt: [8, 3, 0], fov: 45 },
  { at: 0.8, pos: [-5, 3, -3], lookAt: [-8, 0.5, -6], fov: 42 },
  { at: 1.0, pos: [0, 15, 30], lookAt: [0, 2, 0], fov: 60 },
];

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function getInterpolated(progress: number) {
  const p = Math.max(0, Math.min(1, progress));

  let i = 0;
  for (; i < KEYFRAMES.length - 1; i++) {
    if (p <= KEYFRAMES[i + 1].at) break;
  }
  if (i >= KEYFRAMES.length - 1) i = KEYFRAMES.length - 2;

  const kf0 = KEYFRAMES[i];
  const kf1 = KEYFRAMES[i + 1];
  const localT = (p - kf0.at) / (kf1.at - kf0.at);
  const t = smoothstep(Math.max(0, Math.min(1, localT)));

  return {
    pos: kf0.pos.map((v, j) => v + (kf1.pos[j] - v) * t) as [number, number, number],
    lookAt: kf0.lookAt.map((v, j) => v + (kf1.lookAt[j] - v) * t) as [number, number, number],
    fov: kf0.fov + (kf1.fov - kf0.fov) * t,
  };
}

export function CameraRig() {
  const { camera } = useThree();
  const targetPos = useRef(new Vector3());
  const targetLookAt = useRef(new Vector3());
  const currentLookAt = useRef(new Vector3(0, 2, 0));

  useFrame(() => {
    const progress = scrollState.progress;
    const { pos, lookAt, fov } = getInterpolated(progress);

    targetPos.current.set(pos[0], pos[1], pos[2]);
    targetLookAt.current.set(lookAt[0], lookAt[1], lookAt[2]);

    const cam = camera as PerspectiveCamera;
    cam.position.lerp(targetPos.current, 0.1);
    currentLookAt.current.lerp(targetLookAt.current, 0.1);
    cam.lookAt(currentLookAt.current);

    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * 0.1;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
