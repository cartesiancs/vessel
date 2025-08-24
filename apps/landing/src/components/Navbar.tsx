import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Link, useNavigate } from "react-router";

export function Navbar() {
  const navigate = useNavigate();
  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <header className='fixed flex items-center justify-center top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70'>
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
                className={`${navigationMenuTriggerStyle()} bg-transparent`}
                onClick={() => openInNewTab("/docs/introduction")}
                style={{ cursor: "pointer" }}
              >
                Docs
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={`${navigationMenuTriggerStyle()} bg-transparent`}
                onClick={() =>
                  openInNewTab("https://github.com/cartesiancs/vessel")
                }
                style={{ cursor: "pointer" }}
              >
                GitHub
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={`${navigationMenuTriggerStyle()} bg-transparent`}
                onClick={() => navigate("/roadmap")}
                style={{ cursor: "pointer" }}
              >
                Roadmap
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}
