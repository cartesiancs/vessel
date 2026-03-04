import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";

const LAPTOP_POS: [number, number, number] = [-1, 0.85, 3.5];

const CONNECTIONS: { from: [number, number, number]; color: string }[] = [
  { from: [5, 8, -3], color: "#ffffff" }, // Drone
  { from: [-8, 0.5, -6], color: "#ffffff" }, // Robot
];

function AnimatedLine({
  start,
  end,
  mid,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  mid: [number, number, number];
  color: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null);

  useFrame((state) => {
    if (!lineRef.current) return;
    const material = lineRef.current.material;
    if (material && "dashOffset" in material) {
      material.dashOffset = -state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <QuadraticBezierLine
      ref={lineRef}
      start={start}
      end={end}
      mid={mid}
      color={color}
      lineWidth={1.5}
      dashed
      dashSize={0.4}
      dashScale={1}
      gapSize={0.3}
      transparent
      opacity={0.5}
    />
  );
}

export function DataFlowLines() {
  return (
    <group>
      {CONNECTIONS.map((conn, i) => {
        const midY = Math.max(conn.from[1], LAPTOP_POS[1]) + 2;
        const mid: [number, number, number] = [
          (conn.from[0] + LAPTOP_POS[0]) / 2,
          midY,
          (conn.from[2] + LAPTOP_POS[2]) / 2,
        ];
        return (
          <AnimatedLine
            key={i}
            start={conn.from}
            end={LAPTOP_POS}
            mid={mid}
            color={conn.color}
          />
        );
      })}
    </group>
  );
}
