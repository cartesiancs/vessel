import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ArrowRight } from "lucide-react";

const contactMethods = [
  {
    title: "Email",
    value: "info@cartesiancs.com",
    href: "mailto:info@cartesiancs.com",
  },
  {
    title: "LinkedIn",
    value: "company/cartesiancs",
    href: "https://www.linkedin.com/company/cartesiancs",
  },
];

function ContactPage() {
  return (
    <>
      <Navbar />
      <main className='w-screen bg-background text-foreground'>
        {/* Hero Section */}
        <section className='flex min-h-[600px] flex-col items-center justify-center px-8 md:px-10'>
          <div className='flex max-w-3xl flex-col items-center gap-y-6 text-center'>
            <h1 className='text-4xl md:text-6xl lg:text-6xl md:leading-17 leading-10 md:font-bold font-semibold tracking-tight text-center'>
              Contact Us
            </h1>
          </div>
        </section>

        <div className='container mx-auto mt-12 mb-30 max-w-6xl px-8 md:px-10'>
          <div className='space-y-8'>
            {contactMethods.map((method) => (
              <div
                key={method.title}
                className='flex flex-col gap-2 border-b border-border pb-6'
              >
                <p className='text-sm text-muted-foreground'>{method.title}</p>
                <a
                  href={method.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='group inline-flex w-fit items-center gap-2 text-md tracking-tight transition-opacity md:text-2xl'
                >
                  <span className='transition-opacity group-hover:opacity-60'>
                    {method.value}
                  </span>
                  <ArrowRight className='h-4 w-4 translate-x-[-4px] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 md:h-5 md:w-5' />
                </a>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default ContactPage;
