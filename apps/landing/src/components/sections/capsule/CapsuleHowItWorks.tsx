import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";
import EncryptionFlowIllustration from "./EncryptionFlowIllustration";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const steps = [
  {
    number: "01",
    title: "Key Exchange",
    description:
      "X25519 ECDH establishes a shared secret between your device and the server. No keys are ever transmitted in plaintext.",
  },
  {
    number: "02",
    title: "Message Sealing",
    description:
      "XChaCha20-Poly1305 encrypts every message with a unique nonce. Authenticated encryption prevents any tampering.",
  },
  {
    number: "03",
    title: "Zero Residue",
    description:
      "After processing, all plaintext, keys, and decrypted images are automatically zeroized from memory. Nothing persists.",
  },
];

export function CapsuleHowItWorks() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      className='h-full w-full bg-neutral-950 text-white'
    >
      <div
        className={cx(
          "container mx-auto flex h-full max-w-6xl flex-col gap-12 px-8 py-30 md:flex-row md:items-center md:justify-between",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='w-full md:w-[46%]'>
          <h2 className='text-4xl font-semibold tracking-tight md:text-5xl'>
            How Capsule
            <br />
            <span className='font-serif font-medium'>Protects You</span>
          </h2>

          <div className='mt-10 space-y-8'>
            {steps.map((step) => (
              <div key={step.number} className='flex gap-4'>
                <div className='flex h-8 w-8 shrink-0 items-center justify-center border border-white/20 text-sm font-semibold text-white'>
                  {step.number}
                </div>
                <div>
                  <h3 className='text-base font-semibold'>{step.title}</h3>
                  <p className='mt-1 text-sm leading-relaxed text-white/55'>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='w-full md:w-[54%]'>
          <div className='relative h-[260px] w-full md:h-[320px]'>
            <EncryptionFlowIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
