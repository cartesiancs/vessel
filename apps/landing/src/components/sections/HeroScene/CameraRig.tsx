import { useFrame } from "@react-three/fiber";
import { scrollState } from "./HeroScene";

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

const START_POS: [number, number, number] = [-1.5, 1, 5.5];
const END_POS: [number, number, number] = [-0.4, 0.7, 3.8];

export function CameraRig() {
  useFrame(
    (state) => {
      const progress = smoothstep(scrollState.progress);

      const x = START_POS[0] + (END_POS[0] - START_POS[0]) * progress;
      const y = START_POS[1] + (END_POS[1] - START_POS[1]) * progress;
      const z = START_POS[2] + (END_POS[2] - START_POS[2]) * progress;

      state.camera.position.set(x, y, z);
      state.camera.lookAt(0, 0, 0);
      state.camera.updateMatrixWorld(true);
    },
    -1,
  );

  return null;
}
