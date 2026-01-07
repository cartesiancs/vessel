import React from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SecurityCTASection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='h-full w-full bg-black text-white'>
      <div
        className={cx(
          "container mx-auto flex h-full max-w-6xl flex-col gap-12 px-4 py-16 md:flex-row md:items-center md:justify-between",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='w-full md:w-[46%]'>
          <h2 className='text-4xl font-semibold tracking-tight md:text-5xl'>
            Zero Tracker.
            <br />
            <span className='font-serif font-medium'>Absolute Privacy</span>
          </h2>

          <div className='mt-8 flex flex-wrap items-center gap-4'>
            <button
              type='button'
              className='inline-flex h-11 items-center justify-center bg-white px-5 text-sm font-medium text-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 cursor-pointer'
              onClick={() =>
                window.open("https://github.com/cartesiancs/vessel")
              }
            >
              How Vessel works
            </button>

            <button
              type='button'
              className='inline-flex h-11 items-center justify-center border border-white/30 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 cursor-pointer'
              onClick={() => (location.href = "/privacy")}
            >
              Privacy
            </button>
          </div>
        </div>

        <div className='w-full md:w-[54%]'>
          <div className='relative h-[260px] w-full md:h-[320px]'></div>
        </div>
      </div>
    </section>
  );
}
