import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraRig } from "./CameraRig";
import { SceneContent } from "./SceneContent";

const SCROLL_PAGES = 6;

/** Module-level scroll state for R3F components (no re-renders). */
export const scrollState = { progress: 0 };

function SceneLabels({ progress }: { progress: number }) {
  const labels = [
    { title: "Remote Command Center", range: [0.0, 0.18] },
    { title: "Drone Surveillance", range: [0.2, 0.38] },
    { title: "Perimeter Security", range: [0.4, 0.58] },
    { title: "Robot Control", range: [0.6, 0.78] },
    { title: "Connected Network", range: [0.82, 1.0] },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {labels.map((label) => {
        const [start, end] = label.range;
        const fadeIn = start + 0.04;
        const fadeOut = end - 0.04;

        let opacity = 0;
        if (progress >= start && progress <= end) {
          if (progress < fadeIn) opacity = (progress - start) / 0.04;
          else if (progress > fadeOut) opacity = (end - progress) / 0.04;
          else opacity = 1;
        }

        return (
          <div
            key={label.title}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center"
            style={{ opacity: Math.max(0, Math.min(1, opacity)) }}
          >
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {label.title}
            </h3>
          </div>
        );
      })}
    </div>
  );
}

export function HeroSceneSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [labelProgress, setLabelProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollableDistance = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    const progress =
      scrollableDistance > 0 ? scrolled / scrollableDistance : 0;
    const clamped = Math.max(0, Math.min(1, progress));

    // Module-level for R3F (no re-render)
    scrollState.progress = clamped;
    // React state for HTML labels
    setLabelProgress(clamped);
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
      className="relative bg-black"
    >
      <div className="sticky top-0 h-screen flex items-center justify-center">
        <SceneLabels progress={labelProgress} />
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          camera={{ position: [0, 8, 30], fov: 55, near: 0.1, far: 200 }}
          style={{ background: "#000000" }}
        >
          <Suspense fallback={null}>
            <CameraRig />
            <SceneContent />
          </Suspense>
        </Canvas>
      </div>
    </section>
  );
}
