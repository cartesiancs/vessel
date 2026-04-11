const footerNav = {
  resources: [
    { name: "Pricing", href: "/pricing" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Usecase", href: "/usecase" },
    { name: "Contact", href: "/contact" },
    { name: "Privacy", href: "/privacy" },
    { name: "Capsule", href: "/capsule" },
  ],
  contents: [
    { name: "Privacy Policy", href: "/privacy-policy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Disclaimer", href: "/disclaimer" },
    {
      name: "Change Log",
      href: "https://github.com/cartesiancs/vessel/releases",
    },
    { name: "GitHub", href: "https://github.com/cartesiancs/vessel" },
  ],
  company: [
    { name: "Blog", href: "https://blog.cartesiancs.com/" },
    { name: "About", href: "https://cartesiancs.com/about" },
    { name: "LinkedIn", href: "https://www.linkedin.com/company/cartesiancs" },
    { name: "X", href: "https://x.com/cartesiancs" },
    {
      name: "Instagram",
      href: "https://www.instagram.com/cartesiancs.official/",
    },
    {
      name: "Youtube",
      href: "https://www.youtube.com/@cartesiancs",
    },
  ],
};

export function Footer() {
  return (
    <footer className='bg-background border-t'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        <div className='lg:grid lg:grid-cols-4 lg:gap-12'>
          <div className='space-y-4'>
            <p className='text-lg font-bold'>Vessel</p>
            <p className='text-sm text-muted-foreground'>
              Orchestrate physical devices with a single platform
            </p>
          </div>

          <div className='mt-12 grid grid-cols-3 gap-16 sm:grid-cols-3 lg:col-start-3 lg:col-span-3 lg:mt-0'>
            <div>
              <h3 className='text-sm font-semibold leading-6 text-foreground'>
                Resources
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
                Contents
              </h3>
              <ul role='list' className='mt-4 space-y-1'>
                {footerNav.contents.map((item) => (
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
