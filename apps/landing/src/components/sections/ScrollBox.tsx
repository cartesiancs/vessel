import { useState, useEffect, useRef, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

const EXTRA_SCROLL_PX = 1000;

function RotatingBox({ progress }: { progress: number }) {
  const meshRef = useRef<Mesh>(null);
  const targetRotation = useRef({ x: 0, y: 0 });

  targetRotation.current = {
    x: progress * Math.PI * 2,
    y: progress * Math.PI * 2,
  };

  useFrame(() => {
    if (!meshRef.current) return;
    const lerpFactor = 0.1;
    meshRef.current.rotation.x +=
      (targetRotation.current.x - meshRef.current.rotation.x) * lerpFactor;
    meshRef.current.rotation.y +=
      (targetRotation.current.y - meshRef.current.rotation.y) * lerpFactor;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

export function ScrollBoxSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const sectionHeight = rect.height;
    const viewportHeight = window.innerHeight;

    const scrollableDistance = sectionHeight - viewportHeight;
    const scrolled = -rect.top;
    const progress =
      scrollableDistance > 0 ? scrolled / scrollableDistance : 0;

    setScrollProgress(Math.max(0, Math.min(1, progress)));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <section
      ref={sectionRef}
      style={{ height: `calc(100vh + ${EXTRA_SCROLL_PX}px)` }}
      className="relative bg-black"
    >
      <div className="sticky top-0 h-screen flex items-center justify-center">
        <Canvas
          gl={{ alpha: false }}
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ background: "#000000" }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <pointLight position={[-5, -5, -5]} intensity={0.5} />
          <RotatingBox progress={scrollProgress} />
        </Canvas>
      </div>
    </section>
  );
}
