import { useGLTF } from "@react-three/drei";
import type { JSX } from "react";

export function Engineer(props: JSX.IntrinsicElements["group"]) {
  const { scene } = useGLTF("/glb/Engineer.glb");

  return (
    <group {...props}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/glb/Engineer.glb");
