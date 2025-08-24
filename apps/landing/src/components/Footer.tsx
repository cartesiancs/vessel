const footerNav = {
  resources: [
    { name: "Roadmap", href: "/roadmap" },
    { name: "Usecase", href: "/usecase" },

    { name: "GitHub", href: "https://github.com/cartesiancs/vessel" },
  ],
  company: [
    { name: "About", href: "https://cartesiancs.com/about" },
    { name: "LinkedIn", href: "https://www.linkedin.com/company/cartesiancs" },
  ],
};

export function Footer() {
  return (
    <footer className='bg-background border-t'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        <div className='lg:grid lg:grid-cols-5 lg:gap-8'>
          <div className='space-y-4'>
            <p className='text-lg font-bold'>Vessel</p>
            <p className='text-sm text-muted-foreground'>
              Orchestrate physical devices with a single platform
            </p>
          </div>

          <div className='mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:col-start-4 lg:col-span-2 lg:mt-0'>
            <div>
              <h3 className='text-sm font-semibold leading-6 text-foreground'>
                Contents
              </h3>
              <ul role='list' className='mt-4 space-y-1'>
                {footerNav.resources.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className='text-sm leading-6 text-muted-foreground hover:text-foreground'
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className='text-sm font-semibold leading-6 text-foreground'>
                Company
              </h3>
              <ul role='list' className='mt-4 space-y-1'>
                {footerNav.company.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-sm leading-6 text-muted-foreground hover:text-foreground'
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
