import { useGLTF } from "@react-three/drei";
import type { JSX } from "react";

export function Drone(props: JSX.IntrinsicElements["group"]) {
  const { scene } = useGLTF("/glb/Drone.glb");

  return (
    <group {...props}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/glb/Drone.glb");
