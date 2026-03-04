import { useGLTF } from "@react-three/drei";
import type { JSX } from "react";

export function SecurityCamera(props: JSX.IntrinsicElements["group"]) {
  const { scene } = useGLTF("/glb/SecurityCamera.glb");

  return (
    <group {...props} scale={5}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/glb/SecurityCamera.glb");
