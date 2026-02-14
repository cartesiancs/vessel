import { useState } from "react";
import { Plus } from "lucide-react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type FAQItem = {
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    question: "What is Capsule?",
    answer:
      "Capsule is a secure, privacy-first AI chat service. Every conversation is end-to-end encrypted using X25519 ECDH key exchange and XChaCha20-Poly1305 authenticated encryption, ensuring that only you and the AI can access your messages.",
  },
  {
    question: "Can Capsule read my messages?",
    answer:
      "No. Capsule uses a zero-knowledge architecture. Messages are encrypted on your device before transmission. The server processes encrypted payloads and never has access to plaintext content. Private keys are never persisted to disk.",
  },
  {
    question: "What encryption does Capsule use?",
    answer:
      "Capsule uses X25519 Elliptic Curve Diffie-Hellman for key exchange and XChaCha20-Poly1305 for authenticated encryption. Key derivation uses HKDF-SHA256. All keys are automatically zeroized from memory after use.",
  },
  {
    question: "Does image analysis compromise my privacy?",
    answer:
      "No. Images are encrypted client-side before upload using the same X25519 + XChaCha20-Poly1305 scheme. The server decrypts them only for GPT-4o vision analysis, then immediately zeroizes all image data from memory.",
  },
  {
    question: "What happens to my data if there is a breach?",
    answer:
      "Even in a breach scenario, your data remains unreadable. All messages are transmitted encrypted, encryption keys are never persisted on the server, and memory is automatically zeroized after each request.",
  },
  {
    question: "How does the subscription work?",
    answer:
      "Capsule uses JWT-based authentication through Supabase. Subscribe to a Pro plan for full access to encrypted AI chat and image analysis, with rate-limited usage to ensure fair service for all users.",
  },
];

export function CapsuleFaq() {
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
        <div className='mb-12 text-left'>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
            Frequently Asked{" "}
            <span className='text-neutral-500'>Questions</span>
          </h2>
        </div>

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
                  aria-controls={`capsule-faq-panel-${idx}`}
                  id={`capsule-faq-trigger-${idx}`}
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
                  id={`capsule-faq-panel-${idx}`}
                  role='region'
                  aria-labelledby={`capsule-faq-trigger-${idx}`}
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
