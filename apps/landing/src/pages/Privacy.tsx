import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { SecurityCTASection } from "@/components/sections/SecurityCta";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";
import {
  EyeOff,
  Code,
  HardDrive,
  Lock,
  UserCheck,
  BookOpen,
  Server,
  Wifi,
  Eye,
  ShieldCheck,
  Globe,
  Check,
  X,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const privacyPrinciples = [
  {
    icon: EyeOff,
    title: "No Tracking",
    description:
      "Vessel contains zero analytics trackers, no telemetry beacons, and no fingerprinting. Your usage patterns are never observed or recorded.",
  },
  {
    icon: Code,
    title: "Open Source",
    description:
      "Every line of the Vessel core is publicly auditable on GitHub. You never have to trust a black box — verify the code yourself.",
  },
  {
    icon: HardDrive,
    title: "Local-First",
    description:
      "All processing happens on your own hardware. Sensor data, video streams, and automation logic stay on your network by default.",
  },
  {
    icon: Lock,
    title: "Encrypted by Design",
    description:
      "Connections between your devices and Vessel use industry-standard encryption. When you opt into cloud services, data is encrypted in transit and at rest.",
  },
  {
    icon: UserCheck,
    title: "You Own Your Data",
    description:
      "There is no data harvesting, no profiling, and no selling of information to third parties. Your operational data is yours alone.",
  },
  {
    icon: BookOpen,
    title: "Full Transparency",
    description:
      "Our privacy policy is written in plain language. We disclose every piece of data we collect and exactly how it is used.",
  },
];

const cloudCollected = [
  {
    label: "Account information",
    detail: "Name and email via Google OAuth for authentication.",
  },
  {
    label: "Payment data",
    detail: "Processed by Polar. We never store full card numbers.",
  },
  {
    label: "Tunnel usage metadata",
    detail: "Connection logs and usage statistics for service delivery.",
  },
  {
    label: "Device connection metadata",
    detail: "Device identifiers and connection data for tunnel routing.",
  },
  {
    label: "Server logs",
    detail: "IP addresses and access times for security and troubleshooting.",
  },
];

const neverCollected = [
  "Your sensor data or video streams",
  "The content of your automation flows",
  "Your device configurations or credentials",
  "Location data from your devices",
  "Behavioral analytics or usage profiling",
  "Data from your self-hosted deployments",
];

export function PrivacyPage() {
  const { ref: principlesRef, isVisible: principlesVisible } =
    useFadeInOnScroll<HTMLElement>();
  const { ref: selfHostRef, isVisible: selfHostVisible } =
    useFadeInOnScroll<HTMLElement>();
  const { ref: cloudRef, isVisible: cloudVisible } =
    useFadeInOnScroll<HTMLElement>();

  return (
    <>
      <Navbar />
      <main className='w-screen bg-background text-foreground'>
        {/* Hero Section */}
        <section className='flex min-h-[600px] flex-col items-center justify-center px-8 md:px-10'>
          <div className='flex max-w-3xl flex-col items-center gap-y-6 text-center'>
            <h1 className='text-4xl font-semibold tracking-tight md:text-6xl md:font-bold md:leading-17 leading-10'>
              <span className='font-serif font-medium'>Absolute Privacy</span>
            </h1>
            <div className='flex items-center gap-x-4 pt-2'>
              <Button
                variant='default'
                onClick={() => (location.href = "/privacy-policy")}
              >
                Read Privacy Policy
              </Button>
              <Button
                variant='outline'
                onClick={() =>
                  window.open("https://github.com/cartesiancs/vessel")
                }
              >
                <FaGithub />
                View Source Code
              </Button>
            </div>
          </div>
        </section>

        {/* Privacy Principles */}
        <section ref={principlesRef} className='w-full bg-black text-white'>
          <div
            className={cx(
              "container mx-auto max-w-6xl px-8 py-24 md:px-10",
              "transition-all duration-700 ease-out",
              principlesVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6",
            )}
          >
            <div className='mb-14 text-left'>
              <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
                Privacy by Principle,{" "}
                <span className='text-neutral-500'>not by Promise</span>
              </h2>
            </div>
            <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3'>
              {privacyPrinciples.map((principle, index) => {
                const Icon = principle.icon;
                return (
                  <div
                    key={principle.title}
                    className={cx(
                      "space-y-4 border border-white/10 p-6 transition-all duration-700 ease-out",
                      principlesVisible
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4",
                    )}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className='flex h-12 w-12 items-center justify-center border border-white/10 bg-white/5'>
                      <Icon
                        className='h-6 w-6 text-white/80'
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3 className='text-lg font-semibold text-white'>
                      {principle.title}
                    </h3>
                    <p className='text-sm leading-relaxed text-white/55'>
                      {principle.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Self-Host Section */}
        <section
          ref={selfHostRef}
          className='h-full w-full bg-neutral-950 text-white'
        >
          <div
            className={cx(
              "container mx-auto flex h-full max-w-6xl flex-col gap-12 px-8 py-16 md:flex-row md:items-center md:justify-between md:px-10",
              "transition-all duration-700 ease-out",
              selfHostVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6",
            )}
          >
            <div className='w-full md:w-[46%]'>
              <h2 className='text-4xl font-semibold tracking-tight md:text-5xl'>
                <span className='font-serif font-medium'>
                  Self-Host, Self-Own.
                </span>
              </h2>
              <p className='mt-6 text-base leading-relaxed text-white/60'>
                The Vessel core is fully open source. When you self-host, your
                data never touches our servers.
              </p>
              <div className='mt-8 flex flex-wrap items-center gap-4'>
                <button
                  type='button'
                  className='inline-flex h-11 cursor-pointer items-center justify-center bg-white px-5 text-sm font-medium text-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
                  onClick={() =>
                    window.open("https://github.com/cartesiancs/vessel")
                  }
                >
                  See GitHub
                </button>
              </div>
            </div>
            <div className='w-full md:w-[54%]'>
              <div className='space-y-4 border border-white/10 p-8'>
                <div className='flex items-center gap-3'>
                  <Server className='h-5 w-5 text-white/60' strokeWidth={1.5} />
                  <span className='text-sm text-white/80'>
                    Your server, your rules
                  </span>
                </div>
                <div className='flex items-center gap-3'>
                  <Wifi className='h-5 w-5 text-white/60' strokeWidth={1.5} />
                  <span className='text-sm text-white/80'>
                    Works fully offline
                  </span>
                </div>
                <div className='flex items-center gap-3'>
                  <Eye className='h-5 w-5 text-white/60' strokeWidth={1.5} />
                  <span className='text-sm text-white/80'>
                    Every line of code auditable
                  </span>
                </div>
                <div className='flex items-center gap-3'>
                  <ShieldCheck
                    className='h-5 w-5 text-white/60'
                    strokeWidth={1.5}
                  />
                  <span className='text-sm text-white/80'>
                    No telemetry, no phone-home
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cloud Services Privacy */}
        <section ref={cloudRef} className='w-full bg-black text-white'>
          <div
            className={cx(
              "container mx-auto max-w-6xl px-8 py-24 md:px-10",
              "transition-all duration-700 ease-out",
              cloudVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6",
            )}
          >
            <div className='mb-14 text-left'>
              <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
                When You Use Our Cloud,{" "}
                <span className='text-neutral-500'>here is what happens.</span>
              </h2>
              <p className='mt-4 max-w-2xl text-base leading-relaxed text-white/55'>
                If you choose to use Vessel's cloud services such as Remote
                Tunnel, we collect only what is strictly necessary to provide
                the service. Here is a complete breakdown.
              </p>
            </div>

            <div className='grid gap-8 md:grid-cols-2'>
              <div className='space-y-6 border border-white/10 p-8'>
                <h3 className='text-xl font-semibold text-white'>
                  What We Collect
                </h3>
                <ul className='space-y-4'>
                  {cloudCollected.map((item) => (
                    <li key={item.label} className='flex items-start gap-3'>
                      <Check className='mt-0.5 h-5 w-5 shrink-0 text-white/40' />
                      <div>
                        <span className='text-sm font-medium text-white'>
                          {item.label}
                        </span>
                        <p className='mt-1 text-sm text-white/45'>
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className='space-y-6 border border-white/10 p-8'>
                <h3 className='text-xl font-semibold text-white'>
                  What We Never Collect
                </h3>
                <ul className='space-y-4'>
                  {neverCollected.map((item) => (
                    <li key={item} className='flex items-start gap-3'>
                      <X className='mt-0.5 h-5 w-5 shrink-0 text-white/40' />
                      <span className='text-sm text-white/55'>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <SecurityCTASection />
      </main>
      <Footer />
    </>
  );
}
