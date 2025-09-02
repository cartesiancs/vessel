import { Button } from "@/components/ui/button";

export function ErrorRender() {
  return (
    <div className='bg-background flex h-[calc(100%_-_34px)] items-center justify-center p-6 md:p-10'>
      <div className='flex w-full max-w-lg flex-col items-center text-center md:flex-row md:items-center md:gap-8 md:text-left'>
        <h1 className='text-9xl font-extrabold tracking-tighter text-blue-500'>
          ERR
        </h1>
        <div className='mt-4 md:mt-0'>
          <h2 className='text-2xl mb-2 font-semibold text-foreground'>
            An error has occurred. Please try again.
          </h2>
          <Button onClick={() => (location.href = "/")}>Go To Main</Button>
        </div>
      </div>
    </div>
  );
}
