import { useGLTF } from "@react-three/drei";
import type { JSX } from "react";

export function Robot(props: JSX.IntrinsicElements["group"]) {
  const { scene } = useGLTF("/glb/Robot.glb");

  return (
    <group {...props}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/glb/Robot.glb");
