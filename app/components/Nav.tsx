"use client";

import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function Nav() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [showDropdown, setShowDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutsideDropdown(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    document.addEventListener("mousedown", handleClickOutsideDropdown);
    window.addEventListener("scroll", handleScroll);

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideDropdown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex w-full justify-center px-4 pt-4 sm:pt-6 md:pt-8 transition-all duration-300 pointer-events-none">
      <div className="relative flex items-center justify-between w-full max-w-3xl pointer-events-auto">
        <div
          className={`absolute inset-0 rounded-full transition-all duration-500 pointer-events-none ${
            scrolled
              ? "bg-white/60 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.1)] backdrop-blur-2xl border border-white/60"
              : "bg-white/20 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] backdrop-blur-xl border border-white/20"
          }`}
        ></div>

        <nav className="relative z-10 flex items-center justify-between w-full px-6 md:px-8 py-3 md:py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-slate-900 text-lg md:text-xl font-bold font-sans tracking-tight leading-tight">
              Khoj
            </span>
          </Link>

          <div className="flex items-center gap-2 md:gap-4 lg:gap-6">
            {isSignedIn && isLoaded && (
              <>
                <div className="hidden sm:flex items-center gap-1 bg-slate-900/5 p-1 rounded-full border border-slate-900/5">
                  <Link
                    href="/planner"
                    className={`px-4 py-1.5 rounded-full text-[13px] md:text-sm font-medium font-sans transition-all duration-300 ${
                      isActive("/planner")
                        ? "bg-white text-slate-900 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)]"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Planner
                  </Link>
                  <Link
                    href="/map"
                    className={`px-4 py-1.5 rounded-full text-[13px] md:text-sm font-medium font-sans transition-all duration-300 ${
                      isActive("/map")
                        ? "bg-white text-slate-900 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)]"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Map
                  </Link>
                </div>

                <div className="relative flex items-center" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="rounded-full overflow-hidden w-9 h-9 md:w-10 md:h-10 border border-slate-900/10 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 ring-2 ring-transparent hover:ring-slate-900/10"
                  >
                    <img
                      src={user.imageUrl}
                      alt="Profile"
                      className="object-cover w-full h-full"
                    />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-900/10 py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      {/* Mobile Only Nav items in dropdown */}
                      <div className="sm:hidden border-b border-slate-900/10 pb-2 mb-2">
                        <Link
                          href="/planner"
                          className={`block px-4 py-2 text-sm font-medium font-sans ${isActive("/planner") ? "text-slate-900 bg-slate-50" : "text-slate-600 hover:text-slate-900"}`}
                          onClick={() => setShowDropdown(false)}
                        >
                          Planner
                        </Link>
                        <Link
                          href="/map"
                          className={`block px-4 py-2 text-sm font-medium font-sans ${isActive("/map") ? "text-slate-900 bg-slate-50" : "text-slate-600 hover:text-slate-900"}`}
                          onClick={() => setShowDropdown(false)}
                        >
                          Map
                        </Link>
                      </div>

                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors font-sans"
                        onClick={() => setShowDropdown(false)}
                      >
                        Profile
                      </Link>
                      <div className="h-px bg-slate-900/10 my-1" />
                      <button
                        onClick={() => signOut()}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors font-sans"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {isLoaded && !isSignedIn && (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth"
                  className="hidden sm:block text-slate-600 hover:text-slate-900 text-[13px] md:text-sm font-medium font-sans transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/auth"
                  className="px-4 md:px-5 py-2 md:py-[8px] bg-slate-900 text-white rounded-full text-[13px] md:text-sm font-semibold font-sans hover:bg-slate-800 transition-colors shadow-[0px_4px_12px_rgba(15,23,42,0.15)] relative overflow-hidden"
                >
                  <div className="w-full h-full absolute left-0 top-[-0.5px] bg-linear-to-b from-[rgba(255,255,255,0.2)] to-[rgba(255,255,255,0)] mix-blend-overlay rounded-full pointer-events-none"></div>
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
