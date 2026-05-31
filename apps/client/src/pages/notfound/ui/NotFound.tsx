import { Link } from "react-router";

export function NotFound() {
  return (
    <div className='bg-background flex h-[calc(100%_-_34px)] items-center justify-center p-6 md:p-10'>
      <div className='flex w-full max-w-lg flex-col items-center text-center md:flex-row md:items-center md:gap-8 md:text-left'>
        <h1 className='text-9xl font-extrabold tracking-tighter text-primary'>
          404
        </h1>
        <div className='mt-4 md:mt-0'>
          <h2 className='text-2xl font-semibold text-foreground'>
            Page Not Found
          </h2>
          <p className='mt-2 text-base text-muted-foreground'>
            Sorry, the page you are looking for might not exist or has been
            moved.
          </p>
          <Link
            to='/dashboard'
            className='mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none'
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
