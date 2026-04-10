import * as THREE from "three";
import { useMemo, useContext, createContext, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Merged, useVideoTexture } from "@react-three/drei";

const context = createContext<any>(null);

export function Instances({ children, ...props }: any) {
  const { nodes } = useGLTF("/glb/Computers.glb") as any;
  const instances = useMemo(
    () => ({
      Object1: nodes.Object_16,
      Sphere: nodes.Sphere,
    }),
    [nodes],
  );
  return (
    <Merged castShadow receiveShadow meshes={instances} {...props}>
      {(instances: any) => (
        <context.Provider value={instances} children={children} />
      )}
    </Merged>
  );
}

export function Computers(props: any) {
  const { nodes: n, materials: m } = useGLTF("/glb/Computers.glb") as any;
  const instances = useContext(context);
  return (
    <group {...props} dispose={null}>
      <instances.Object1
        position={[0, 0, 0]}
        rotation={[0, 0.17, 0]}
        scale={1.52}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={n.Object_18.geometry}
        material={m.Texture}
        position={[-0.82, 0, 0.04]}
        rotation={[0, -0.06, 0]}
        scale={1.52}
      />
      <ScreenVideo
        frame='Object_206'
        panel='Object_207'
        position={[-0.36, 1.53, 0.39]}
      />
      <Leds instances={instances} />
    </group>
  );
}

function ScreenVideo({ frame, panel, ...props }: any) {
  const { nodes, materials } = useGLTF("/glb/Computers.glb") as any;
  const texture = useVideoTexture("/video/video.mp4", {
    loop: true,
    muted: true,
    playsInline: true,
  });

  const screen = useMemo(() => {
    const geo = nodes[panel].geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    return {
      width: bb.max.x - bb.min.x,
      height: bb.max.y - bb.min.y,
      center: [
        (bb.max.x + bb.min.x) / 2,
        (bb.max.y + bb.min.y) / 2,
        bb.max.z + 0.005,
      ] as [number, number, number],
    };
  }, [nodes, panel]);

  return (
    <group {...props}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes[frame].geometry}
        material={materials.Texture}
      />
      <mesh position={screen.center}>
        <planeGeometry args={[screen.width, screen.height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Leds({ instances }: any) {
  const ref = useRef<THREE.Group>(null!);
  const { nodes } = useGLTF("/glb/Computers.glb") as any;
  useMemo(() => {
    nodes.Sphere.material = new THREE.MeshBasicMaterial();
    nodes.Sphere.material.toneMapped = false;
  }, []);
  useFrame((state) => {
    ref.current.children.forEach((instance: any) => {
      const rand = Math.abs(2 + instance.position.x);
      const t = Math.round(
        (1 + Math.sin(rand * 10000 + state.clock.elapsedTime * rand)) / 2,
      );
      instance.color.setRGB(0, t * 1.1, t);
    });
  });
  return (
    <group ref={ref}>
      <instances.Sphere
        position={[-1.04, 1.1, 0.79]}
        scale={0.005}
        color={[1, 2, 1]}
      />
      <instances.Sphere
        position={[-0.04, 1.32, 0.78]}
        scale={0.005}
        color={[1, 2, 1]}
      />
    </group>
  );
}

useGLTF.preload("/glb/Computers.glb");
