import React from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ImageSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full bg-black text-white'>
      <div
        className={cx(
          "container mx-auto max-w-6xl px-4 py-20 md:py-28",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mx-auto max-w-4xl text-center'>
          <h2 className='text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.05]'>
            <span className='text-white/70'>Offline First.</span>
            <br />
            <span className='text-white'>No internet required.</span>
          </h2>
        </div>

        <div className='mx-auto mt-14 w-full max-w-5xl'>
          <div className='relative mx-auto w-full overflow-hidden border border-white/10 bg-black'>
            <img
              src='/images/map.png'
              alt='Device preview'
              className='block h-[320px] w-full object-cover md:h-[520px]'
              loading='lazy'
            />
          </div>
        </div>
      </div>
    </section>
  );
}
