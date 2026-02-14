import React from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FooterCtaSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full bg-black text-white'>
      <div
        className={cx(
          "container mx-auto max-w-6xl px-8 md:px-10 py-24 md:py-32",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mx-auto flex max-w-3xl flex-col items-center text-center'>
          <h2 className='text-4xl font-semibold tracking-tight md:text-5xl'>
            <span className='text-white/50'>Built</span>{" "}
            <span className='text-white'>for independence</span>
          </h2>

          <p className='mt-5 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl'>
            Vessel is a proactive security system that enables users to achieve
            complete control over their physical spaces.
          </p>

          <div className='mt-10'>
            <button
              className={cx(
                "inline-flex h-12 items-center justify-center px-6",
                "border border-white/25 bg-transparent text-base font-medium text-white",
                "transition-colors hover:border-white/45 hover:bg-white/5",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 cursor-pointer",
              )}
              onClick={() =>
                window.open("https://github.com/cartesiancs/vessel")
              }
            >
              See GitHub
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
