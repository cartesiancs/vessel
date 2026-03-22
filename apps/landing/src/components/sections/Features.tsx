import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

const features = [
  {
    number: "01",
    title: "Flow",
    description:
      "Orchestrate sensors and automations with a flow-based editor that connects devices, AI models, and actions.",
    highlight: "Orchestrate sensors",
    image: "/images/flow.webp",
    alt: "Flow visual editor",
  },
  {
    number: "02",
    title: "Dashboard",
    description:
      "Track streams and system health in one place with a centralized command view.",
    highlight: "Track streams",
    image: "/images/dashboard.webp",
    alt: "Dashboard monitoring",
  },
  {
    number: "03",
    title: "Map",
    description:
      "Coordinate devices spatially with a map UI for faster decisions and responses.",
    highlight: "Coordinate devices",
    image: "/images/map.webp",
    alt: "Map based interface",
  },
];

function HighlightedText({
  text,
  highlight,
  animate,
  delay,
}: {
  text: string;
  highlight: string;
  animate: boolean;
  delay: number;
}) {
  const idx = text.indexOf(highlight);
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + highlight.length);
  const after = text.slice(idx + highlight.length);

  return (
    <>
      {before}
      <span className='relative inline'>
        <span
          className='absolute inset-0 -mx-0.5 bg-white/90 origin-left transition-transform duration-700 ease-out'
          style={{
            transform: animate ? "scaleX(1)" : "scaleX(0)",
            transitionDelay: `${delay}ms`,
          }}
        />
        <span
          className='relative transition-colors duration-700'
          style={{
            color: animate ? "#171717" : undefined,
            transitionDelay: `${delay}ms`,
          }}
        >
          {match}
        </span>
      </span>
      {after}
    </>
  );
}

export function FeaturesSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full'>
      <div
        className={`container mx-auto max-w-7xl px-5 md:px-10 py-32 transition-all duration-700 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Header */}
        <div className='mb-10 text-left'>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl leading-tight'>
            Physical AI Platform.{" "}
            <span className='text-neutral-500'>Local-First by Design.</span>
          </h2>
        </div>

        {/* Feature Cards */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-0'>
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`relative border border-dashed border-neutral-700 p-6 flex flex-col transition-all duration-500 ease-out ${
                index === 0 ? "md:col-span-2" : ""
              } ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              {/* Number Label */}
              <span className='text-sm text-neutral-500 tracking-widest font-mono'>
                [ {feature.number} ]
              </span>

              {/* Image Area */}
              <div className='flex-1 flex items-center justify-center py-12'>
                <img
                  src={feature.image}
                  alt={feature.alt}
                  className='h-48 w-full object-cover opacity-60'
                  loading='lazy'
                />
              </div>

              {/* Description */}
              <p className='text-sm leading-relaxed text-neutral-300'>
                <HighlightedText
                  text={feature.description}
                  highlight={feature.highlight}
                  animate={isVisible}
                  delay={300 + index * 1500}
                />
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
