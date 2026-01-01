const usecases = [
  {
    title: "Autonomous Perimeter Ops",
    description:
      "Coordinate sensors, cameras, and automated responses across large sites without relying on cloud connectivity.",
    image: "/images/map.png",
    alt: "Perimeter operations map",
  },
  {
    title: "Mission Control Watchtower",
    description:
      "Fuse live feeds, alerts, and playbooks into a single command layer for faster, safer decisions.",
    image: "/images/dashboard.png",
    alt: "Mission control dashboard",
  },
];

export function UsecaseSection() {
  return (
    <section className='w-full'>
      <div className='container mx-auto max-w-6xl px-4 py-16'>
        <div className='mb-12 text-left'>
          <h2 className='mt-3 text-3xl font-bold tracking-tight md:text-4xl'>
            Home Protection{" "}
            <span className='text-neutral-500'>for Independent Living</span>
          </h2>
          <p className='mt-3 text-lg text-muted-foreground'>
            Vessel is a SaaS platform designed to remotely manage and control
            multiple devices within home or RV environments.
          </p>
        </div>

        <div className='space-y-10'>
          {usecases.map((usecase) => (
            <article
              key={usecase.title}
              className='group flex min-h-screen flex-col overflow-hidden border border-border bg-card text-card-foreground'
            >
              <div className='relative flex-1'>
                <img
                  src={usecase.image}
                  alt={usecase.alt}
                  className='absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]'
                  loading='lazy'
                />
                <div
                  className='absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent'
                  aria-hidden='true'
                />
              </div>
              {/* <div className='p-6'>
                <h3 className='text-xl font-semibold'>{usecase.title}</h3>
                <p className='mt-2 text-sm text-muted-foreground'>
                  {usecase.description}
                </p>
              </div> */}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
