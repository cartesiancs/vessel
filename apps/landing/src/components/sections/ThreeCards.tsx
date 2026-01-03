import React from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

type Card = {
  image: string;
  alt: string;
  title: string;
  description: string;
};

const cards: Card[] = [
  {
    image: "/images/flow.png",
    alt: "Device connections",
    title: "Connect your devices.",
    description:
      "Bring cameras, sensors, and edge nodes into one command layer with a visual, flow-based setup.",
  },
  {
    image: "/images/flow.png",
    alt: "Threat detection",
    title: "Detect threats in real time.",
    description:
      "Turn signals into actionable alerts by routing events through your detection and escalation logic.",
  },
  {
    image: "/images/flow.png",
    alt: "Automated response",
    title: "Orchestrate and respond.",
    description:
      "Automate playbooks that coordinate devices and actions when conditions are met—no cloud required.",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ThreeCardsSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full bg-black text-white'>
      <div
        className={cx(
          "container mx-auto max-w-6xl px-4 py-16",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='grid gap-10 md:grid-cols-3'>
          {cards.map((c) => (
            <div key={c.title} className='space-y-6'>
              <div className='overflow-hidden bg-white/5'>
                <img
                  src={c.image}
                  alt={c.alt}
                  className='h-[320px] w-full object-cover md:h-[360px]'
                  loading='lazy'
                />
              </div>

              <p className='text-lg leading-snug'>
                <span className='font-semibold text-white'>{c.title} </span>
                <span className='text-white/55'>{c.description}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
