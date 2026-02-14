import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

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

function EncryptionFlowIllustration() {
  return (
    <svg
      viewBox='0 0 900 360'
      className='h-full w-full'
      role='img'
      aria-label='Encryption flow diagram showing Client to Server to AI'
    >
      <defs>
        <pattern id='capsule-grid' width='36' height='36' patternUnits='userSpaceOnUse'>
          <path
            d='M 36 0 L 0 0 0 36'
            fill='none'
            stroke='rgba(255,255,255,0.06)'
            strokeWidth='1'
          />
        </pattern>
        <style>
          {`
            .capsule-dash { stroke: rgba(255,255,255,0.45); stroke-dasharray: 8 10; stroke-width: 2; fill: none; }
            .capsule-glow { stroke: rgba(255,255,255,0.12); stroke-width: 3; fill: none; }
          `}
        </style>
        <path
          id='capsule-route'
          d='M150,180 C250,180 300,120 450,120 C600,120 650,180 750,180'
        />
      </defs>

      <rect x='0' y='0' width='900' height='360' fill='url(#capsule-grid)' />

      {/* Connection lines */}
      <use href='#capsule-route' className='capsule-glow' />
      <use href='#capsule-route' className='capsule-dash' />

      {/* Animated packet */}
      <g>
        <rect width='16' height='10' rx='2' fill='rgba(255,255,255,0.7)'>
          <animateMotion dur='4s' repeatCount='indefinite'>
            <mpath href='#capsule-route' />
          </animateMotion>
        </rect>
      </g>

      {/* Client Node */}
      <g transform='translate(150,180)'>
        <circle r='36' fill='rgba(255,255,255,0.05)' stroke='rgba(255,255,255,0.2)' strokeWidth='1.5' />
        <text textAnchor='middle' y='5' fill='rgba(255,255,255,0.8)' fontSize='14' fontWeight='600'>
          Client
        </text>
        <text textAnchor='middle' y='70' fill='rgba(255,255,255,0.4)' fontSize='11'>
          Encrypt
        </text>
      </g>

      {/* Server Node */}
      <g transform='translate(450,120)'>
        <circle r='36' fill='rgba(255,255,255,0.05)' stroke='rgba(255,255,255,0.2)' strokeWidth='1.5' />
        <text textAnchor='middle' y='-2' fill='rgba(255,255,255,0.8)' fontSize='13' fontWeight='600'>
          Capsule
        </text>
        <text textAnchor='middle' y='14' fill='rgba(255,255,255,0.8)' fontSize='13' fontWeight='600'>
          Server
        </text>
        <text textAnchor='middle' y='70' fill='rgba(255,255,255,0.4)' fontSize='11'>
          Process
        </text>
        {/* Lock icon */}
        <rect x='-6' y='-42' width='12' height='9' rx='2' fill='none' stroke='rgba(255,255,255,0.5)' strokeWidth='1.2' />
        <path d='M-3,-42 L-3,-47 A3,3 0 0,1 3,-47 L3,-42' fill='none' stroke='rgba(255,255,255,0.5)' strokeWidth='1.2' />
      </g>

      {/* AI Node */}
      <g transform='translate(750,180)'>
        <circle r='36' fill='rgba(255,255,255,0.05)' stroke='rgba(255,255,255,0.2)' strokeWidth='1.5' />
        <text textAnchor='middle' y='5' fill='rgba(255,255,255,0.8)' fontSize='14' fontWeight='600'>
          AI
        </text>
        <text textAnchor='middle' y='70' fill='rgba(255,255,255,0.4)' fontSize='11'>
          Respond
        </text>
      </g>
    </svg>
  );
}

export function CapsuleHowItWorks() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='h-full w-full bg-neutral-950 text-white'>
      <div
        className={cx(
          "container mx-auto flex h-full max-w-6xl flex-col gap-12 px-4 py-16 md:flex-row md:items-center md:justify-between",
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
