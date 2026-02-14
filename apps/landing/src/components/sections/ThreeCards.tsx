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
    image: "/images/ha.webp",
    alt: "Device connections",
    title: "Home Assistant.",
    description:
      "Connect with every supported device. Powered by the world’s most powerful IoT hub.",
  },
  {
    image: "/images/robotarm.webp",
    alt: "Threat detection",
    title: "Robot Control.",
    description: "Control robots in real time with ROS 2’s powerful protocols.",
  },
  {
    image: "/images/watch.webp",
    alt: "Automated response",
    title: "Fundamental Control.",
    description:
      "Bring real-time data from WebSocket, MQTT, and HTTP straight into your flow logic.",
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
          "container mx-auto max-w-6xl px-8 md:px-10 py-16",
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
