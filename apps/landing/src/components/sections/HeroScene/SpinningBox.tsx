import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import type { Mesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";

interface SpinningBoxProps {
  scale?: number;
  position?: [number, number, number];
  [key: string]: any;
}

export function SpinningBox({ scale = 1, ...props }: SpinningBoxProps) {
  const ref = useRef<Mesh>(null!);
  const [hovered, hover] = useState(false);
  const [clicked, click] = useState(false);
  useCursor(hovered);

  useFrame((_state, delta) => {
    ref.current.rotation.x = ref.current.rotation.y += delta;
  });

  return (
    <mesh
      {...props}
      ref={ref}
      scale={clicked ? scale * 1.4 : scale * 1.2}
      onClick={(_event: ThreeEvent<MouseEvent>) => click(!clicked)}
      onPointerOver={(_event: ThreeEvent<PointerEvent>) => hover(true)}
      onPointerOut={(_event: ThreeEvent<PointerEvent>) => hover(false)}
    >
      <boxGeometry />
      <meshStandardMaterial color={hovered ? "hotpink" : "indianred"} />
    </mesh>
  );
}
