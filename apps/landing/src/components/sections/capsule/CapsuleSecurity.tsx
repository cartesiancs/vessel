import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";
import { ShieldCheck } from "lucide-react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CapsuleSecurity() {
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
            Zero Knowledge
            <br />
            Architecture.
            <br />
            <span className='font-serif font-medium'>Absolute Encryption</span>
          </h2>

          <p className='mt-6 text-base leading-relaxed text-white/55'>
            Capsule cannot read your messages. The server processes encrypted
            payloads and returns encrypted results. Even in a breach, your data
            remains unreadable. Private keys exist only in memory and are never
            persisted to disk.
          </p>

          <div className='mt-8 flex flex-wrap items-center gap-4'>
            <button
              type='button'
              className='inline-flex h-11 items-center justify-center bg-white px-5 text-sm font-medium text-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 cursor-pointer'
              onClick={() => (location.href = "/privacy")}
            >
              View Privacy Policy
            </button>

            <button
              type='button'
              className='inline-flex h-11 items-center justify-center border border-white/30 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 cursor-pointer'
              onClick={() => (location.href = "/pricing")}
            >
              See Pricing
            </button>
          </div>
        </div>

        <div className='w-full md:w-[54%]'>
          <div className='relative flex h-[260px] w-full items-center justify-center md:h-[320px]'>
            {/* Decorative concentric rings */}
            <div className='absolute h-64 w-64 rounded-full border border-white/5' />
            <div className='absolute h-48 w-48 rounded-full border border-white/8' />
            <div className='absolute h-32 w-32 rounded-full border border-white/12' />
            <ShieldCheck
              className='relative h-16 w-16 text-white/60'
              strokeWidth={1.2}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
