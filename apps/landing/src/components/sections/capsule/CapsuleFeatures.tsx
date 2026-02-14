import {
  Lock,
  Image,
  Radio,
  ShieldCheck,
  KeyRound,
  Server,
} from "lucide-react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";
import type { ComponentType } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Feature = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description:
      "Every message encrypted with X25519 ECDH + XChaCha20-Poly1305 before leaving your device. No one but you and the AI can read it.",
  },
  {
    icon: Image,
    title: "Encrypted Image Analysis",
    description:
      "Send images for AI analysis. Images are encrypted client-side and processed securely via GPT-4o vision, then wiped from memory.",
  },
  {
    icon: Radio,
    title: "Streaming Responses",
    description:
      "Real-time AI responses delivered via Server-Sent Events. Watch answers appear token-by-token as they are generated.",
  },
  {
    icon: ShieldCheck,
    title: "Memory Protection",
    description:
      "Automatic zeroization ensures all sensitive data — keys, plaintext, images — is wiped from server memory immediately after use.",
  },
  {
    icon: KeyRound,
    title: "Powerful Authentication",
    description:
      "Secure session management backed by Supabase authentication with ES256 token validation and audience checks.",
  },
  {
    icon: Server,
    title: "Hardened Deployment",
    description:
      "Alpine-based containers running as non-root with read-only filesystems. Minimal attack surface by design.",
  },
];

export function CapsuleFeatures() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section
      id='features'
      ref={sectionRef}
      className='w-full bg-black text-white'
    >
      <div
        className={cx(
          "container mx-auto max-w-6xl px-4 py-24",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='mb-14 text-left'>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
            Built for Security,{" "}
            <span className='text-neutral-500'>from the Ground Up</span>
          </h2>
        </div>

        <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3'>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={cx(
                  "space-y-4 border border-white/10 p-6 transition-all duration-700 ease-out",
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4",
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className='flex h-12 w-12 items-center justify-center bg-white/5 border border-white/10'>
                  <Icon className='h-6 w-6 text-white/80' strokeWidth={1.5} />
                </div>
                <h3 className='text-lg font-semibold text-white'>
                  {feature.title}
                </h3>
                <p className='text-sm leading-relaxed text-white/55'>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
