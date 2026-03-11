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
    title: "Flow Auto-Generation",
    description:
      "Describe what you want in natural language and the AI agent instantly builds a complete automation flow.",
    image: "/images/ai1.webp",
    alt: "AI generating automation flow",
  },
  {
    title: "Home Status Analysis",
    description:
      "The AI continuously monitors sensor data, cameras, and device states to understand what is happening at home and surface actionable insights in real time.",
    image: "/images/house.webp",
    alt: "AI analyzing home status",
  },
  {
    title: "Flow Integration",
    description:
      "Seamlessly merge AI-generated suggestions into your existing flows. The agent resolves conflicts, optimizes triggers, and keeps everything in sync.",
    image: "/images/factory.webp",
    alt: "AI integrating into existing flows",
  },
  {
    title: "Capsule Security",
    description:
      "Every AI action runs inside an isolated capsule with scoped permissions, ensuring that automation never exceeds the boundaries you define.",
    image: "/images/s1.webp",
    alt: "Capsule-based security layer",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function UsecaseAIAssistantSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();
  const [activeIndex, setActiveIndex] = useState(0);

  const active = useMemo(() => usecases[activeIndex], [activeIndex]);

  return (
    <section ref={sectionRef} className='w-full'>
      <div
        className={cx(
          "container mx-auto max-w-7xl px-5 md:px-10 py-30 transition-all duration-700 ease-out",
          "flex flex-col",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mb-10 text-left'>
          <h2 className='mt-3 text-3xl font-bold tracking-tight md:text-4xl'>
            AI Agent{" "}
            <span className='text-neutral-500'>
              for understanding the world
            </span>
          </h2>
        </div>

        {/* Image area – crossfade */}
        <div className='relative w-full overflow-hidden aspect-[16/10] md:aspect-[16/9]'>
          {usecases.map((u, idx) => (
            <img
              key={u.image}
              src={u.image}
              alt={u.alt}
              className={cx(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out",
                idx === activeIndex ? "opacity-100" : "opacity-0",
              )}
              loading='lazy'
            />
          ))}
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
