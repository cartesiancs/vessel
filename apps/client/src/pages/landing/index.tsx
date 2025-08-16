import { Button } from "@/components/ui/button";
import { BookText, LogIn } from "lucide-react";
import { FaGithub } from "react-icons/fa";

function LandingPage() {
  return (
    <main className='flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground'>
      <div className='flex flex-col items-center gap-y-6'>
        <h1 className='text-4xl md:text-6xl lg:text-6xl leading-17 font-bold tracking-tight text-center'>
          The open source <br /> alternative of Anduril
        </h1>
        <div className='flex items-center gap-x-4 pt-2'>
          <Button variant={"default"} onClick={() => (location.href = "/auth")}>
            <LogIn /> Auth
          </Button>
          <Button variant='outline'>
            <BookText /> Docs
          </Button>
          <Button
            onClick={() => window.open("https://github.com/cartesiancs/vessel")}
            variant='outline'
          >
            <FaGithub />
            GitHub
          </Button>
        </div>
      </div>
    </main>
  );
}

export default LandingPage;
