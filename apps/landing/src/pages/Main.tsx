import { Button } from "@/components/ui/button";
import { BookText } from "lucide-react";
import { FaGithub } from "react-icons/fa";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

function LandingPage() {
  return (
    <>
      <Navbar />
      <main className='flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground'>
        <div className='flex flex-col items-center gap-y-6'>
          <h1 className='text-4xl md:text-6xl lg:text-6xl md:leading-17 leading-10 md:font-bold font-semibold tracking-tight text-center'>
            The open source <br /> alternative to Anduril
          </h1>
          <div className='flex items-center gap-x-4 pt-2'>
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
      </main>
      <Footer />
    </>
  );
}

export default LandingPage;
