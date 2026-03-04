export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.15} color="#4466aa" />
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.5}
        color="#ffeedd"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-10, 8, -10]} intensity={0.3} color="#aaccff" />
      <pointLight position={[0, 10, -15]} intensity={0.5} color="#ffffff" />
    </>
  );
}
