import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";
import { Shield } from "lucide-react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CapsulePromoSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full'>
      <div
        className={cx(
          "container mx-auto max-w-7xl px-8 md:px-10 py-16",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <a
          href='/capsule'
          className='block rounded-3xl bg-neutral-900 px-10 py-14 md:px-16 md:py-16 transition-colors hover:bg-neutral-800/90 cursor-pointer'
        >
          <div className='flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-16'>
            <div className='flex shrink-0 items-center justify-center'>
              <Shield
                className='h-20 w-20 text-white md:h-24 md:w-24'
                strokeWidth={1.4}
              />
            </div>

            <div className='text-base leading-relaxed tracking-tight text-neutral-400 md:text-lg md:leading-relaxed'>
              Vessel is{" "}
              <span className='font-semibold text-white'>
                designed to protect your privacy
              </span>{" "}
              at every step. It encrypts your messages on-device through
              end-to-end encryption. So it processes your conversations without
              ever accessing your personal data. And with zero-knowledge
              architecture, Capsule can deliver powerful AI responses while
              ensuring your privacy is never compromised.
            </div>
          </div>
        </a>
      </div>
    </section>
  );
}
