import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function CapsuleHero() {
  return (
    <section className='flex h-[600px] flex-col items-center justify-center px-4'>
      <div className='flex flex-col items-center gap-y-6'>
        <h1 className='text-4xl md:text-6xl lg:text-6xl md:leading-17 leading-10 md:font-bold font-semibold tracking-tight text-center'>
          Capsule
        </h1>
        <div className='flex items-center gap-x-4 pt-2'>
          <Button
            variant='default'
            onClick={() => (location.href = "/pricing")}
          >
            Get Started
          </Button>
          <Button
            variant='outline'
            onClick={() =>
              (location.href = "https://github.com/cartesiancs/vessel")
            }
          >
            Learn More
          </Button>
        </div>
      </div>
    </section>
  );
}
