import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

type Slide = {
  image: string;
  alt: string;
  title: string;
  caption: string;
};

const slides: Slide[] = [
  {
    image: "/images/s1.webp",
    alt: "Smart home dashboard",
    title: "Edge orchestration",
    caption: "Connect every device and keep control at the edge.",
  },
  {
    image: "/images/s2.webp",
    alt: "Industrial robot arm",
    title: "Low-latency control",
    caption: "Drive ROS 2 robots with dependable, real-time flows.",
  },
  {
    image: "/images/s3.webp",
    alt: "Factory overview",
    title: "Mission control",
    caption: "See every stream and respond instantly from one place.",
  },
  {
    image: "/images/s4.webp",
    alt: "Wearable alerting",
    title: "Always-on insight",
    caption: "Surface critical signals wherever your teams are.",
  },
];

const defaultTrackPadding = "clamp(1.5rem, 4vw, 3rem)";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ListCardsSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paddingInline, setPaddingInline] = useState<{
    left: string;
    right: string;
  }>({
    left: defaultTrackPadding,
    right: defaultTrackPadding,
  });

  const scrollToIndex = (index: number) => {
    const target = cardRefs.current[index];
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
    setActiveIndex(index);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;

      let closestIndex = activeIndex;
      let smallestDistance = Number.POSITIVE_INFINITY;

      cardRefs.current.forEach((card, idx) => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(center - cardCenter);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          closestIndex = idx;
        }
      });

      if (closestIndex !== activeIndex) {
        setActiveIndex(closestIndex);
      }
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", handleScroll);
    };
  }, [activeIndex]);

  useEffect(() => {
    const updatePadding = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const style = window.getComputedStyle(container);
      const left = rect.left + (parseFloat(style.paddingLeft ?? "0") || 0);
      const right =
        window.innerWidth -
        rect.right +
        (parseFloat(style.paddingRight ?? "0") || 0);

      setPaddingInline({
        left: `${Math.max(left, 0)}px`,
        right: `${Math.max(right, 0)}px`,
      });
    };

    updatePadding();
    window.addEventListener("resize", updatePadding);
    return () => {
      window.removeEventListener("resize", updatePadding);
    };
  }, []);

  return (
    <section ref={sectionRef} className='w-full text-white'>
      <div
        ref={containerRef}
        className={cx(
          "container mx-auto max-w-7xl px-5 md:px-10 py-16",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mb-6 flex items-baseline justify-between gap-6'>
          <div>
            <h2 className='text-3xl font-semibold text-neutral-400 md:text-4xl'>
              Take a closer look.
            </h2>
          </div>
        </div>

        <div className='relative'>
          <div
            ref={trackRef}
            className='relative left-1/2 flex w-screen -translate-x-1/2 snap-x snap-mandatory gap-6 overflow-x-auto pb-8 cursor-grab active:cursor-grabbing'
            style={{
              paddingLeft: paddingInline.left,
              paddingRight: paddingInline.right,
              scrollPaddingLeft: paddingInline.left,
              scrollPaddingRight: paddingInline.right,
            }}
          >
            {slides.map((slide, idx) => (
              <div
                key={slide.title}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                className='relative flex aspect-video shrink-0 snap-start basis-[85%] items-end overflow-hidden border border-white/10 bg-gradient-to-b from-white/10 to-white/5 shadow-[0_30px_120px_rgba(0,0,0,0.5)] md:aspect-auto md:h-[520px] md:basis-[70%]'
              >
                <img
                  src={slide.image}
                  alt={slide.alt}
                  className='absolute inset-0 h-full w-full object-cover'
                  loading='lazy'
                />
              </div>
            ))}
          </div>

          <div className='mt-4 hidden justify-end gap-2 md:flex'>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() =>
                  scrollToIndex(
                    (activeIndex - 1 + slides.length) % slides.length,
                  )
                }
                className='flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-white transition hover:border-white/20 hover:bg-white/10 cursor-pointer'
                aria-label='View previous slide'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>
              <button
                type='button'
                onClick={() => scrollToIndex((activeIndex + 1) % slides.length)}
                className='flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-white transition hover:border-white/20 hover:bg-white/10 cursor-pointer'
                aria-label='View next slide'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
