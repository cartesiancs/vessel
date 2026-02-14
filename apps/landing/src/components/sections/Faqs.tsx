import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

type FAQItem = {
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    question: "What is Vessel?",
    answer:
      "Vessel is an open-source “Command & Control (C2)” platform that connects, monitors, and orchestrates physical sensors through a visual, flow-based interface, aiming to enable proactive security (from detection to automated response)",
  },
  {
    question: "How does the Flow system work, and what can I automate?",
    answer:
      "Vessel lets you build automation workflows by visually connecting nodes in a pipeline like Sensor (Input) → Logic (Process) → Device/Action (Output). This enables code-free rules (for example, triggering actions via integrations such as Home Assistant) using a drag-and-drop flow editor.",
  },
  {
    question: "Can I use this service without an internet connection?",
    answer:
      "Yes. It can be used without the internet. It was designed with a local-first, offline-first approach and built to give users complete control.",
  },
  {
    question: "How do I install/run Vessel, and is it production-ready?",
    answer:
      "You can run Vessel locally by starting the Rust-based server and the web client (Node/npm), or use Docker; the repository README provides the step-by-step commands. The project is explicitly described as under active development/POC, and it also states it is intended for academic and research purposes with responsibility for use resting with the user.",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FAQSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  return (
    <section ref={sectionRef} className='h-full w-full bg-black text-white'>
      <div
        className={cx(
          "container mx-auto flex h-full max-w-6xl flex-col px-8 md:px-10 py-16",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='w-full'>
          {faqs.map((item, idx) => {
            const isOpen = activeIndex === idx;
            return (
              <div key={item.question} className='border-b border-gray-300/40'>
                <button
                  type='button'
                  onClick={() => setActiveIndex(isOpen ? null : idx)}
                  className={cx(
                    "flex w-full items-center justify-between gap-4 py-5 text-left",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  )}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${idx}`}
                  id={`faq-trigger-${idx}`}
                >
                  <div className='min-w-0 text-base font-semibold leading-snug'>
                    {item.question}
                  </div>

                  <Plus
                    className={cx(
                      "h-5 w-5 flex-none transition-transform duration-200",
                      isOpen ? "rotate-45" : "rotate-0",
                    )}
                    aria-hidden='true'
                  />
                </button>

                <div
                  id={`faq-panel-${idx}`}
                  role='region'
                  aria-labelledby={`faq-trigger-${idx}`}
                  className={cx(
                    "overflow-hidden transition-[max-height] duration-300 ease-out",
                    isOpen ? "max-h-48" : "max-h-0",
                  )}
                >
                  <div
                    className={cx(
                      "pb-5 text-sm text-white/70 transition-opacity duration-300 ease-out",
                      isOpen ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {item.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
