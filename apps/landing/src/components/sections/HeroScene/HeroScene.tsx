import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  BakeShadows,
  MeshReflectorMaterial,
  OrbitControls,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Instances, Computers } from "./Computers";

export function HeroSceneSection() {
  return (
    <section style={{ height: "30vh" }} className='relative bg-black'>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [-0.4, 0.7, 3.8],
          fov: 45,
          near: 1,
          far: 20,
        }}
        style={{ background: "#000000" }}
      >
        <Suspense fallback={null}>
          <color attach='background' args={["black"]} />
          <hemisphereLight intensity={0.15} groundColor='black' />
          <spotLight
            decay={0}
            position={[10, 20, 10]}
            angle={0.12}
            penumbra={1}
            intensity={1}
            castShadow
            shadow-mapSize={1024}
          />

          <group position={[0, -1, 0]}>
            <Instances>
              <Computers scale={0.5} />
            </Instances>

            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[50, 50]} />
              <MeshReflectorMaterial
                blur={[300, 30]}
                resolution={2048}
                mixBlur={1}
                mixStrength={180}
                roughness={1}
                depthScale={1.2}
                minDepthThreshold={0.4}
                maxDepthThreshold={1.4}
                color='#202020'
                metalness={0.8}
              />
            </mesh>

            <pointLight
              distance={1}
              intensity={0.2}
              position={[-0.15, 0.7, 0]}
              color='#ffa914'
            />
          </group>

          <EffectComposer enableNormalPass={false}>
            <Bloom
              luminanceThreshold={0}
              mipmapBlur
              luminanceSmoothing={0.0}
              intensity={2}
            />
          </EffectComposer>

          <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} />
          <BakeShadows />
        </Suspense>
      </Canvas>
    </section>
  );
}
