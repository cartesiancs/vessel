import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

const features = [
  {
    number: "01",
    title: "Flow",
    description:
      "Orchestrate sensors and automations with a flow-based editor that connects devices, AI models, and actions.",
    image: "/images/flow.png",
    alt: "Flow visual editor",
  },
  {
    number: "02",
    title: "Dashboard",
    description:
      "Track streams, alerts, and system health in one place with a centralized command view.",
    image: "/images/dashboard.png",
    alt: "Dashboard monitoring",
  },
  {
    number: "03",
    title: "Map",
    description:
      "Coordinate devices spatially with a map UI for faster decisions and responses.",
    image: "/images/map.png",
    alt: "Map based interface",
  },
];

export function FeaturesSection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section ref={sectionRef} className='w-full'>
      <div
        className={`container mx-auto max-w-7xl px-8 md:px-10 py-32 transition-all duration-700 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Header */}
        <div className='mb-16 text-left'>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl leading-tight'>
            Physical AI Platform.{" "}
            <span className='text-neutral-500'>Local-First by Design.</span>
          </h2>
        </div>

        {/* Feature Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-0'>
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`relative border border-dashed border-neutral-700 p-6 flex flex-col transition-all duration-500 ease-out ${
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
                  className='max-h-48 w-auto object-contain opacity-60'
                  loading='lazy'
                />
              </div>

              {/* Description */}
              <p className='text-sm leading-relaxed text-neutral-300'>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
