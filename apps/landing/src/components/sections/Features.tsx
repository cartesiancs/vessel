import { useState } from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

const features = [
  {
    title: "Visual Logic Builder",
    description:
      "Orchestrate sensors and automations with a flow-based editor that connects devices, AI models, and actions.",
    image: "/images/flow.png",
    alt: "Flow visual editor",
  },
  {
    title: "Real-Time Monitoring",
    description:
      "Track streams, alerts, and system health in one place with a centralized command view.",
    image: "/images/dashboard.png",
    alt: "Dashboard monitoring",
  },
  {
    title: "Map-Based Control",
    description:
      "Coordinate devices spatially with a map UI for faster decisions and responses.",
    image: "/images/map.png",
    alt: "Map based interface",
  },
];

export function FeaturesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full'>
      <div
        className={`container mx-auto max-w-6xl px-4 py-16 transition-all duration-700 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className='mb-12 text-left'>
          <h2 className='mt-3 text-3xl font-bold tracking-tight md:text-4xl'>
            Proactive Security{" "}
            <span className='text-neutral-500'>
              Platform, Local-First by Design
            </span>
          </h2>
        </div>

        <div className='flex h-[420px] w-full gap-4 md:h-[480px]'>
          {features.map((feature, index) => {
            const isActive = activeIndex === index;

            return (
              <button
                key={feature.title}
                type='button'
                className={`relative flex min-w-0 basis-0 overflow-hidden border border-border transition-[flex-grow,opacity,transform] duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{
                  flexGrow: isActive ? 2.4 : 1,
                  transitionDelay: `${index * 100}ms`,
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                aria-pressed={isActive}
                aria-label={feature.title}
              >
                <img
                  src={feature.image}
                  alt={feature.alt}
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-out ${
                    isActive ? "brightness-100" : "brightness-[0.6]"
                  }`}
                  loading='lazy'
                />
                <div
                  className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent'
                  aria-hidden='true'
                />
                <div
                  className={`absolute inset-x-0 bottom-0 p-6 text-left text-white transition-all duration-500 ease-out ${
                    isActive
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                  aria-hidden={!isActive}
                >
                  <h3 className='text-xl font-semibold'>{feature.title}</h3>
                  <p className='mt-2 text-sm text-white/80'>
                    {feature.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
