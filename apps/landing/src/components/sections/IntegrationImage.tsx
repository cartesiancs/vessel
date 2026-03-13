import React from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const logos = [
  { src: "/logos/ha.webp", alt: "HA" },
  { src: "/logos/ros2.webp", alt: "Ros2" },
  { src: "/logos/ws.webp", alt: "ws" },
  { src: "/logos/mqtt.webp", alt: "mqtt" },
  { src: "/logos/http.webp", alt: "http" },
];

type Logo = { src: string; alt: string };

function LogoMarquee({
  items,
  pxPerSecond = 80,
}: {
  items: Logo[];
  pxPerSecond?: number;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const setRef = React.useRef<HTMLDivElement>(null);
  const [setWidth, setSetWidth] = React.useState(0);
  const [repeat, setRepeat] = React.useState(2);

  React.useEffect(() => {
    const container = containerRef.current;
    const setEl = setRef.current;
    if (!container || !setEl) return;

    const measure = () => {
      const cw = container.clientWidth;
      const sw = setEl.scrollWidth;
      if (cw <= 0 || sw <= 0) return;

      setSetWidth(sw);

      const needed = Math.ceil((cw * 2) / sw) + 1;
      setRepeat(Math.max(2, needed));
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(setEl);

    return () => ro.disconnect();
  }, []);

  const duration = setWidth > 0 ? setWidth / pxPerSecond : 20;

  const trackStyle = {
    ["--marquee-distance" as any]: `${setWidth}px`,
    ["--marquee-duration" as any]: `${duration}s`,
  };

  return (
    <div ref={containerRef} className='relative w-full overflow-hidden'>
      <div className='pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black to-transparent md:w-28' />
      <div className='pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black to-transparent md:w-28' />

      <div className='marquee-track flex w-max items-center' style={trackStyle}>
        <div ref={setRef} className='flex items-center gap-14 pr-14'>
          {items.map((logo) => (
            <div
              key={logo.alt}
              className='flex h-10 items-center justify-center opacity-80 transition-opacity duration-200 hover:opacity-100 md:h-12'
            >
              <img
                src={logo.src}
                alt={logo.alt}
                className='h-full w-auto select-none object-contain'
                loading='lazy'
                draggable={false}
              />
            </div>
          ))}
        </div>

        {Array.from({ length: repeat - 1 }).map((_, i) => (
          <div
            key={i}
            className='flex items-center gap-14 pr-14'
            aria-hidden='true'
          >
            {items.map((logo) => (
              <div
                key={`${logo.alt}-${i}`}
                className='flex h-10 items-center justify-center opacity-80 transition-opacity duration-200 hover:opacity-100 md:h-12'
              >
                <img
                  src={logo.src}
                  alt=''
                  className='h-full w-auto select-none object-contain'
                  loading='lazy'
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <style>{`
        .marquee-track {
          animation: marquee var(--marquee-duration) linear infinite;
          will-change: transform;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-1 * var(--marquee-distance)));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}

export function IntegrationSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full bg-black text-white'>
      <div
        className={cx(
          "container mx-auto max-w-7xl px-5 md:px-10 pt-40 py-10",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mx-auto max-w-4xl text-center'>
          <h2 className='text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.05]'>
            <span className='text-white/70'>Integration</span>
            <br />
            <span className='text-white'>with powerful tools</span>
          </h2>
        </div>

        <div className='mx-auto mt-14 w-full max-w-5xl'>
          <div className='relative mx-auto w-full overflow-hidden bg-black py-10'>
            <LogoMarquee items={logos} pxPerSecond={80} />
          </div>
        </div>
      </div>
    </section>
  );
}
