import { Cpu, Box, Gauge } from "lucide-react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";
import type { ComponentType } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Card = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
};

const cards: Card[] = [
  {
    icon: Cpu,
    title: "Rust Backend.",
    description:
      "Built with Rust for memory safety, zero-cost abstractions, and blazing performance. No garbage collector, no runtime overhead.",
  },
  {
    icon: Box,
    title: "Hardened Containers.",
    description:
      "Alpine Linux, non-root user, read-only filesystem, no shell access. Every layer minimizes the attack surface.",
  },
  {
    icon: Gauge,
    title: "Rate-Limited Access.",
    description:
      "Subscription tiers with intelligent rate limiting. Fair usage guaranteed, abuse prevented at the infrastructure level.",
  },
];

export function CapsuleArchitecture() {
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
        <div className='mb-14 text-left'>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
            Architecture{" "}
            <span className='text-neutral-500'>Built to Last</span>
          </h2>
        </div>

        <div className='grid gap-10 md:grid-cols-3'>
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className='space-y-6'>
                <div className='flex h-[320px] w-full items-center justify-center overflow-hidden bg-white/5 md:h-[360px]'>
                  <Icon
                    className='h-20 w-20 text-white/20'
                    strokeWidth={1}
                  />
                </div>

                <p className='text-lg leading-snug'>
                  <span className='font-semibold text-white'>{c.title} </span>
                  <span className='text-white/55'>{c.description}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
