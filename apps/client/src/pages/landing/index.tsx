import { Button } from "@/components/ui/button";

function LandingPage() {
  return (
    <main className='flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground'>
      <div className='flex flex-col items-center gap-y-6'>
        <h1 className='text-5xl font-bold tracking-tight'>Vessel</h1>
        <div className='flex items-center gap-x-4'>
          <Button onClick={() => (location.href = "/auth")}>Auth</Button>
          <Button variant='outline'>Docs</Button>
          <Button
            onClick={() => window.open("https://github.com/cartesiancs/vessel")}
            variant='secondary'
          >
            GitHub
          </Button>
        </div>
      </div>
    </main>
  );
}

export default LandingPage;
