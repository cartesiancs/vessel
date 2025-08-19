import { Button } from "@/components/ui/button";
import { BookText } from "lucide-react";
import { FaGithub } from "react-icons/fa";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Link } from "react-router";

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
    </>
  );
}

export function Navbar() {
  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <header className='absolute flex items-center justify-center top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='h-12 flex items-center justify-between w-full'>
        <div className='flex items-center'>
          <Link to='/' className='mr-6 flex items-center space-x-2 pl-6 gap-1'>
            <img src='/icon.png' alt='Logo' className='w-8' />
            <span className='hidden font-medium text-sm sm:inline-block'>
              Vessel
            </span>
          </Link>
        </div>

        <NavigationMenu className='pr-2'>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                onClick={() => openInNewTab("/docs/introduction")}
                style={{ cursor: "pointer" }}
              >
                Docs
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                onClick={() =>
                  openInNewTab("https://github.com/cartesiancs/vessel")
                }
                style={{ cursor: "pointer" }}
              >
                GitHub
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}

import { createBrowserRouter, RouterProvider } from "react-router";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
