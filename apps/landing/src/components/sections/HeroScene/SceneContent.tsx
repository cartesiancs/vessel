import { Environment } from "@react-three/drei";
import { Trailer } from "./models/Trailer";
import { Engineer } from "./models/Engineer";
import { Drone } from "./models/Drone";
import { SecurityCamera } from "./models/SecurityCamera";
import { Robot } from "./models/Robot";
import { Ground } from "./environment/Ground";
import { Lighting } from "./environment/Lighting";
import { DataFlowLines } from "./effects/DataFlowLines";

export function SceneContent() {
  return (
    <>
      <Lighting />
      <Environment preset='night' />
      <fog attach='fog' args={["#000000", 30, 80]} />

      <Ground />

      {/* Main objects */}
      <Trailer position={[1, 0, 5]} />
      <Engineer position={[-1, 0.9, 3.5]} rotation={[0, Math.PI * 0.3, 0]} />

      {/* Drone */}
      <Drone position={[5, 8, -3]} />

      {/* Security cameras */}
      <SecurityCamera position={[8, 4, 5]} rotation={[0, -Math.PI / 4, 0]} />
      <SecurityCamera position={[-6, 4, -4]} rotation={[0, Math.PI / 3, 0]} />

      {/* Robot */}
      <Robot position={[-8, 0.5, -6]} />

      {/* Effects */}
      <DataFlowLines />
    </>
  );
}
