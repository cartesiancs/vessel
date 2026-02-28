import React, { useMemo, useState } from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

type Usecase = {
  title: string;
  description: string;
  image: string;
  alt: string;
};

const usecases: Usecase[] = [
  {
    title: "Realtime Control",
    description:
      "Coordinate sensors, cameras, and automated responses across large sites without relying on cloud connectivity.",
    image: "/images/house.webp",
    alt: "Perimeter operations map",
  },
  {
    title: "Mission Control Watchtower",
    description:
      "Fuse live feeds, alerts, and playbooks into a single command layer for faster, safer decisions.",
    image: "/images/factory.webp",
    alt: "Mission control dashboard",
  },
  {
    title: "CCTV Dashboard",
    description:
      "RTSP and low-level UDP RTP video stream support. Aggregate multiple media sources for real-time visibility and control.",
    image: "/images/cctv.webp",
    alt: "Mission control dashboard",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function UsecaseSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();
  const [activeIndex, setActiveIndex] = useState(0);

  const active = useMemo(() => usecases[activeIndex], [activeIndex]);

  return (
    <section ref={sectionRef} className='w-full'>
      <div
        className={cx(
          "container mx-auto max-w-7xl px-5 md:px-10 py-16 transition-all duration-700 ease-out",
          "flex flex-col",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mb-10 text-left'>
          <h2 className='mt-3 text-3xl font-bold tracking-tight md:text-4xl'>
            Explore <span className='text-neutral-500'>What You Can Build</span>
          </h2>
        </div>

        {/* Image area */}
        <div className='relative w-full overflow-hidden aspect-[16/10] md:aspect-[16/9]'>
          <img
            key={active.image}
            src={active.image}
            alt={active.alt}
            className='absolute inset-0 h-full w-full object-cover transition-opacity duration-500'
            loading='lazy'
          />
          <div
            className='absolute inset-0 bg-gradient-to-t from-black/40 to-transparent'
            aria-hidden='true'
          />
        </div>

        {/* Tab bar */}
        <div className='mt-8 flex justify-center gap-4 md:gap-8'>
          {usecases.map((u, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={u.title}
                type='button'
                onClick={() => setActiveIndex(idx)}
                className={cx(
                  "pb-2 text-sm md:text-base font-medium transition-all duration-200 cursor-pointer border-b-2",
                  isActive
                    ? "text-white border-white"
                    : "text-neutral-500 border-transparent hover:text-neutral-300",
                )}
              >
                {u.title}
              </button>
            );
          })}
        </div>

        {/* Description */}
        <p className='mt-6 mx-auto max-w-2xl text-center text-sm md:text-base leading-relaxed text-neutral-400'>
          {active.description}
        </p>
      </div>
    </section>
  );
}
