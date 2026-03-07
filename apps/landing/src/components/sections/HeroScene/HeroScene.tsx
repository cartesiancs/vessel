import { Suspense, useCallback, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { BakeShadows, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { CameraRig } from "./CameraRig";
import { Instances, Computers } from "./Computers";

const SCROLL_PAGES = 3;

export const scrollState = { progress: 0 };

export function HeroSceneSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollableDistance = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    const progress = scrollableDistance > 0 ? scrolled / scrollableDistance : 0;
    scrollState.progress = Math.max(0, Math.min(1, progress));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <section
      ref={sectionRef}
      style={{ height: `${SCROLL_PAGES * 100}vh` }}
      className='relative bg-black'
    >
      <div className='sticky top-0 h-screen'>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{
            position: [-1.5, 1, 5.5],
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

            <CameraRig />
            <BakeShadows />
          </Suspense>
        </Canvas>
      </div>
    </section>
  );
}
