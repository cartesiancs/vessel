import * as THREE from "three";
import { useMemo, useContext, createContext, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  useGLTF,
  Merged,
  RenderTexture,
  PerspectiveCamera,
} from "@react-three/drei";
import { SpinningBox } from "./SpinningBox";

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
      <ScreenInteractive
        frame='Object_206'
        panel='Object_207'
        position={[-0.36, 1.53, 0.39]}
      />
      <Leds instances={instances} />
    </group>
  );
}

function Screen({ frame, panel, children, ...props }: any) {
  const { nodes, materials } = useGLTF("/glb/Computers.glb") as any;
  return (
    <group {...props}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes[frame].geometry}
        material={materials.Texture}
      />
      <mesh geometry={nodes[panel].geometry}>
        <meshBasicMaterial toneMapped={false}>
          <RenderTexture width={512} height={512} attach='map' anisotropy={16}>
            {children}
          </RenderTexture>
        </meshBasicMaterial>
      </mesh>
    </group>
  );
}

function ScreenInteractive(props: any) {
  return (
    <Screen {...props}>
      <PerspectiveCamera
        makeDefault
        manual
        aspect={1 / 1}
        position={[0, 0, 10]}
      />
      <color attach='background' args={["#ffa914"]} />
      <ambientLight intensity={Math.PI / 2} />
      <pointLight decay={0} position={[10, 10, 10]} intensity={Math.PI} />
      <pointLight decay={0} position={[-10, -10, -10]} />
      <SpinningBox position={[-3.15, 0.75, 0]} scale={0.5} />
    </Screen>
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
