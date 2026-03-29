import { useState, useEffect, useRef, useCallback } from "react";

const QUOTE = {
  text: `"Physical AI that discovers, and adapts — built for explorers"`,
  author: "H. Jun Huh",
  title: "Founder · cartesiancs",
};

function Word({ word, progress }: { word: string; progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  // Dark theme: reveal from dark gray (0.3) to white (1.0)
  const lightness = 0.3 + clamped * 0.7;
  const color = `oklch(${lightness} 0 0)`;

  return (
    <span
      style={{
        color,
        transition: "color 0.08s ease-out",
      }}
      className='inline'
    >
      {word}{" "}
    </span>
  );
}

function QuoteSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const sectionHeight = rect.height;
    const viewportHeight = window.innerHeight;

    const scrollableDistance = sectionHeight - viewportHeight;
    const scrolled = -rect.top;
    const progress = scrollableDistance > 0 ? scrolled / scrollableDistance : 0;

    setScrollProgress(Math.max(0, Math.min(1, progress)));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const words = QUOTE.text.split(" ");

  return (
    <section
      ref={sectionRef}
      style={{ height: `${Math.max(250, words.length * 18)}vh` }}
      className='relative'
    >
      <div className='sticky top-0 h-screen flex flex-col items-center justify-center px-[8vw]'>
        <p
          className='text-center font-bold leading-[1.25] tracking-tight max-w-[820px] m-0'
          style={{
            fontSize: "clamp(1.8rem, 4.2vw, 3.6rem)",
            letterSpacing: "-0.02em",
          }}
        >
          {words.map((word, i) => {
            const wordStart = i / words.length;
            const wordEnd = (i + 1) / words.length;
            const wordProgress =
              (scrollProgress - wordStart) / (wordEnd - wordStart);
            return <Word key={i} word={word} progress={wordProgress} />;
          })}
        </p>

        <div
          className='mt-8 text-center'
          style={{
            opacity:
              scrollProgress > 0.15
                ? Math.min(1, (scrollProgress - 0.15) * 3)
                : 0,
            transform: `translateY(${scrollProgress > 0.15 ? 0 : 8}px)`,
            transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
          }}
        >
          <p className='text-sm font-semibold text-foreground m-0 tracking-wide'>
            {QUOTE.author}
          </p>
          <p className='text-xs font-normal text-neutral-500 mt-1 m-0 tracking-wide'>
            {QUOTE.title}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ScrollTextRevealSection() {
  return (
    <section className='w-full'>
      <QuoteSection />
    </section>
  );
}
