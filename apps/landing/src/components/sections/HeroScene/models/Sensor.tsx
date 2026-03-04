import type { JSX } from "react";

export function Sensor(props: JSX.IntrinsicElements["group"]) {
  return (
    <group {...props}>
      {/* Body */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.5, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Antenna */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
        <meshStandardMaterial color="#888888" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Antenna tip */}
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#00aaff" emissive="#00aaff" emissiveIntensity={1.5} />
      </mesh>
      {/* Base plate */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  );
}
