import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

function UsecasePage() {
  return (
    <>
      <Navbar />
      <main className='container mx-auto max-w-3xl px-4 py-12 md:py-16'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-extrabold tracking-tight lg:text-5xl pt-16'>
            Use Case
          </h1>
          <p className='mt-4 text-lg text-muted-foreground'></p>
        </div>

        <div className='relative'>
          <div className='absolute left-3 top-3 h-full w-0.5 bg-border -z-10'></div>

          <div className='space-y-10'></div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default UsecasePage;
