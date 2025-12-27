import { Button } from "@/components/ui/button";
import { BookText } from "lucide-react";
import { FaGithub } from "react-icons/fa";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FeaturesSection } from "@/components/sections/Features";

function LandingPage() {
  return (
    <>
      <Navbar />
      <main className='w-screen bg-background text-foreground'>
        <section className='flex min-h-screen flex-col items-center justify-center px-4'>
          <div className='flex flex-col items-start gap-y-6'>
            <h1 className='self-center text-4xl md:text-6xl lg:text-6xl md:leading-17 leading-10 md:font-bold font-semibold tracking-tight text-center'>
              The open source <br /> alternative to Anduril
            </h1>
            <div className='flex items-center gap-x-4 pt-2 self-center'>
              <Button
                variant='default'
                onClick={() => window.open("/docs/introduction")}
              >
                <BookText /> Docs
              </Button>
              <Button
                onClick={() =>
                  window.open("https://github.com/cartesiancs/vessel")
                }
                variant='outline'
              >
                <FaGithub />
                GitHub
              </Button>
            </div>
          </div>
        </section>

        <FeaturesSection />
      </main>
      <Footer />
    </>
  );
}

export default LandingPage;
