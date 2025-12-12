import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

export function Header() {
  const dark = true;
  return (
    <header
      className={cn("relative w-full flex items-center py-4 z-50 ", {
        "bg-ink-main": dark,
      })}
    >
      <div className="flex w-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-4 lg:gap-8 xl:gap-12">
          <Link to="/" className="flex items-center gap-4 cursor-pointer">
            <img
              className="h-[46.95px] w-[42px] object-cover"
              alt="Moodeng Credit logo"
              // TODO: use public folder
              src="https://c.animaapp.com/VPWnEuWR/img/file--4--1@2x.png"
              width={42}
              height={47}
            />
            <div
              className={cn(
                "font-display font-normal text-2xl whitespace-nowrap cursor-pointer hidden lg:block translate-y-0.5",
                {
                  "text-azure-main": !dark,
                  "text-white font-extrabold": dark,
                },
              )}
            >
              Moodeng Credit
            </div>
          </Link>
          <div
            className={cn("h-8 w-px bg-black/50", {
              "hidden md:block": !dark,
              hidden: dark,
            })}
          ></div>

          <nav
            className={cn(
              "hidden md:flex items-center gap-8 xl:gap-12 text-xl text-nowrap",
              {
                "text-white": dark,
              },
            )}
          >
            <Links />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* {username ? ( */}
          {/*   <UserMenu */}
          {/*     showMenu={showUserMenu} */}
          {/*     onToggleMenu={toggleUserMenu} */}
          {/*     onClose={closeUserMenu} */}
          {/*   /> */}
          {/* ) : ( */}
          {/*   <AuthButtons /> */}
          {/* )} */}

          {/* Mobile menu toggle */}
          <SideBar />
        </div>
      </div>
    </header>
  );
}

function Links() {
  return (
    <>
      <Link to="/guide">Guide</Link>
      <Link to="/whylend">Why Lend?</Link>
      <Link to="/benefits">Benefits</Link>
      <a
        href="https://moodeng-credit.gitbook.io/moodeng-credit"
        target="_blank"
        rel="noreferrer"
      >
        Docs
      </a>
    </>
  );
}

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function SideBar() {
  const dark = true;

  return (
    <Sheet>
      <SheetTrigger className="cursor-pointer">
        <Menu className="text-white" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className={cn("dark text-white pt-4 underline", {
          "bg-ink-main": dark,
        })}
      >
        <div className="p-4 flex flex-col gap-4 text-xl">
          <Links />
        </div>
        <SheetHeader>
          <SheetTitle></SheetTitle>
          <SheetDescription></SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
