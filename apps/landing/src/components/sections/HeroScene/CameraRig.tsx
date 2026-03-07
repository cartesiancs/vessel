import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { scrollState } from "./HeroScene";

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

const START_POS: [number, number, number] = [-1.5, 1, 5.5];
const END_POS: [number, number, number] = [0.1, 0.4, 2.0];

export function CameraRig() {
  useFrame((state, delta) => {
    const progress = smoothstep(scrollState.progress);

    const baseX = START_POS[0] + (END_POS[0] - START_POS[0]) * progress;
    const baseY = START_POS[1] + (END_POS[1] - START_POS[1]) * progress;
    const baseZ = START_POS[2] + (END_POS[2] - START_POS[2]) * progress;

    const pointerInfluence = 1 - progress * 0.8;
    const pointerX =
      ((state.pointer.x * state.viewport.width) / 3) * pointerInfluence;
    const pointerY = ((1 + state.pointer.y) / 2) * pointerInfluence;

    easing.damp3(
      state.camera.position,
      [baseX + pointerX, baseY + pointerY, baseZ],
      0.5,
      delta,
    );
    state.camera.lookAt(0, 0, 0);
  });

  return null;
}
