import { useMemo, useState } from "react";
import { ChevronDown, MessageSquareLock, ScanEye, Users } from "lucide-react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";
import type { ComponentType } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Usecase = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const usecases: Usecase[] = [
  {
    title: "Private AI Assistant",
    description:
      "Ask sensitive questions — financial, medical, legal — without your data being stored or shared. Your queries stay yours, protected by end-to-end encryption.",
    icon: MessageSquareLock,
  },
  {
    title: "Secure Image Analysis",
    description:
      "Upload encrypted photos for AI analysis. Medical scans, documents, personal photos — analyzed privately by GPT-4o vision, never stored on the server.",
    icon: ScanEye,
  },
  {
    title: "Team-Safe Communication",
    description:
      "Subscription-based access with intelligent rate limiting ensures fair usage. JWT authentication keeps every session isolated and accountable.",
    icon: Users,
  },
];

export function CapsuleUsecases() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();
  const [activeIndex, setActiveIndex] = useState(0);

  const active = useMemo(() => usecases[activeIndex], [activeIndex]);

  return (
    <section ref={sectionRef} className='w-full h-[100vh]'>
      <div
        className={cx(
          "container mx-auto max-w-6xl px-8 md:px-10 py-16 transition-all duration-700 ease-out",
          "h-full flex flex-col",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mb-12 text-left'>
          <h2 className='mt-3 text-3xl font-bold tracking-tight md:text-4xl'>
            Use Cases{" "}
            <span className='text-neutral-500'>for Every Scenario</span>
          </h2>
        </div>

        <div className='flex w-full flex-1 flex-col gap-6 lg:flex-row min-h-0'>
          <div className='w-full lg:w-[30%] h-full min-h-0'>
            <div className='h-full overflow-auto'>
              {usecases.map((u, idx) => {
                const isOpen = idx === activeIndex;
                return (
                  <div key={u.title} className='border-b border-gray-500'>
                    <button
                      type='button'
                      onClick={() => setActiveIndex(idx)}
                      className={cx(
                        "flex w-full items-center justify-between gap-4 py-4 text-left",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                      aria-expanded={isOpen}
                      aria-controls={`capsule-usecase-panel-${idx}`}
                      id={`capsule-usecase-trigger-${idx}`}
                    >
                      <div className='min-w-0'>
                        <div className='text-base font-semibold leading-snug'>
                          {u.title}
                        </div>
                      </div>

                      <ChevronDown
                        className={cx(
                          "h-5 w-5 flex-none transition-transform duration-200",
                          isOpen ? "rotate-180" : "rotate-0",
                        )}
                        aria-hidden='true'
                      />
                    </button>

                    <div
                      id={`capsule-usecase-panel-${idx}`}
                      role='region'
                      aria-labelledby={`capsule-usecase-trigger-${idx}`}
                      className={cx(
                        "overflow-hidden transition-[max-height] duration-300 ease-out",
                        isOpen ? "max-h-40" : "max-h-0",
                      )}
                    >
                      <div
                        className={cx(
                          "pb-4 text-sm text-muted-foreground transition-opacity duration-300 ease-out",
                          isOpen ? "opacity-100" : "opacity-0",
                        )}
                      >
                        {u.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className='relative w-full lg:w-[70%] h-full min-h-0'>
            <div className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0 border border-white/10'>
              <active.icon
                className='h-32 w-32 text-white/20 transition-all duration-500'
                strokeWidth={1}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
