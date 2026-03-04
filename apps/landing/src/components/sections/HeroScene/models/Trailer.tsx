import { useGLTF } from "@react-three/drei";
import type { JSX } from "react";

export function Trailer(props: JSX.IntrinsicElements["group"]) {
  const { scene } = useGLTF("/glb/Trailer.glb");

  return (
    <group {...props} scale={5} position={[0, 1.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/glb/Trailer.glb");
