import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

type Usecase = {
  title: string;
  description: string;
  image: string;
  alt: string;
};

const usecases: Usecase[] = [
  {
    title: "Autonomous Perimeter Ops",
    description:
      "Coordinate sensors, cameras, and automated responses across large sites without relying on cloud connectivity.",
    image: "/images/map.png",
    alt: "Perimeter operations map",
  },
  {
    title: "Mission Control Watchtower",
    description:
      "Fuse live feeds, alerts, and playbooks into a single command layer for faster, safer decisions.",
    image: "/images/dashboard.png",
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
    <section ref={sectionRef} className='w-full h-[100vh]'>
      <div
        className={cx(
          "container mx-auto max-w-6xl px-4 py-16 transition-all duration-700 ease-out",
          "h-full flex flex-col",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mb-12 text-left'>
          <h2 className='mt-3 text-3xl font-bold tracking-tight md:text-4xl'>
            Home Protection{" "}
            <span className='text-neutral-500'>for Independent Living</span>
          </h2>
          {/* <p className='mt-3 text-lg text-muted-foreground'>
            Vessel is a SaaS platform designed to remotely manage and control
            multiple devices within home or RV environments.
          </p> */}
        </div>

        <div className='flex w-full flex-1 flex-col gap-6 lg:flex-row min-h-0'>
          <div className='w-full lg:w-[30%] h-full min-h-0'>
            <div className='h-full overflow-auto'>
              {usecases.map((u, idx) => {
                const isOpen = idx === activeIndex;
                return (
                  <div key={u.title} className='border-b border-gray-500'>
                    <button
                      type='button'
                      onClick={() => setActiveIndex(idx)}
                      className={cx(
                        "flex w-full items-center justify-between gap-4 py-4 text-left",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                      aria-expanded={isOpen}
                      aria-controls={`usecase-panel-${idx}`}
                      id={`usecase-trigger-${idx}`}
                    >
                      <div className='min-w-0'>
                        <div className='text-base font-semibold leading-snug'>
                          {u.title}
                        </div>
                      </div>

                      <ChevronDown
                        className={cx(
                          "h-5 w-5 flex-none transition-transform duration-200",
                          isOpen ? "rotate-180" : "rotate-0",
                        )}
                        aria-hidden='true'
                      />
                    </button>

                    <div
                      id={`usecase-panel-${idx}`}
                      role='region'
                      aria-labelledby={`usecase-trigger-${idx}`}
                      className={cx(
                        "overflow-hidden transition-[max-height] duration-300 ease-out",
                        isOpen ? "max-h-40" : "max-h-0",
                      )}
                    >
                      <div
                        className={cx(
                          "pb-4 text-sm text-muted-foreground transition-opacity duration-300 ease-out",
                          isOpen ? "opacity-100" : "opacity-0",
                        )}
                      >
                        {u.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className='relative w-full lg:w-[70%] h-full min-h-0'>
            <div className='absolute inset-0'>
              <img
                key={active.image}
                src={active.image}
                alt={active.alt}
                className='h-full w-full object-cover'
                loading='lazy'
              />
              <div
                className='absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent'
                aria-hidden='true'
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
