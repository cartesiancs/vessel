import { useEffect, useRef, useState } from "react";

const TITLE = "Build your own infrastructure";

export function SubheadingSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className='flex h-[400px] items-center justify-center px-6'
    >
      <h1 className='flex flex-wrap items-center justify-center gap-2 text-center text-neutral-200 text-[48px] font-semibold leading-tight tracking-tight'>
        {TITLE.split(" ").map((word, index) => (
          <span
            key={word + index}
            className={`transform-gpu transition-all duration-700 ease-out ${
              isVisible
                ? "translate-y-0 opacity-100 blur-0"
                : "translate-y-2 opacity-0 blur-sm"
            }`}
            style={{ transitionDelay: `${index * 80}ms` }}
          >
            {word}
          </span>
        ))}
      </h1>
    </section>
  );
}
