import { useRef } from "react";
import { Link, useLocation } from "react-router";

import { Github } from "@/components/github";
import { useIsoLayoutEffect } from "@/lib/utils";

export function Header() {
  const { pathname } = useLocation();
  const links = useRef<HTMLDivElement>(null);
  const index = useRef<HTMLAnchorElement>(null);
  const about = useRef<HTMLAnchorElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);

  useIsoLayoutEffect(() => {
    const update = () => {
      const active = pathname === "/about" ? about.current : index.current;
      if (!active || !indicator.current) return;
      indicator.current.style.width = `${active.offsetWidth}px`;
      indicator.current.style.transform = `translateX(${active.offsetLeft}px)`;
    };

    update();
    const observer = new ResizeObserver(update);
    if (links.current) observer.observe(links.current);
    if (index.current) observer.observe(index.current);
    if (about.current) observer.observe(about.current);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-10 h-[var(--header-height)]">
      <div className="container flex h-full items-center justify-center">
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-1 bg-blue-600 px-1 py-2 text-xs tracking-[0.16em] text-white sm:gap-4 sm:px-4"
        >
          <Link to="/" className="whitespace-nowrap text-lg font-semibold tracking-tight">
            Hyperkinetic <span className="font-normal text-white/60">/ Basic</span>
          </Link>
          <div ref={links} className="relative ml-[4.25rem] flex gap-3 sm:ml-[5.75rem] sm:gap-6">
            <span
              ref={indicator}
              aria-hidden="true"
              className="absolute bottom-1 left-0 h-px bg-white motion-safe:transition-[transform,width] motion-safe:duration-300 motion-safe:ease-out"
            />
            <Link
              ref={index}
              to="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className="py-1 transition-opacity hover:opacity-60"
            >
              INDEX
            </Link>
            <Link
              ref={about}
              to="/about"
              aria-current={pathname === "/about" ? "page" : undefined}
              className="py-1 transition-opacity hover:opacity-60"
            >
              ABOUT
            </Link>
          </div>
          <a
            href="https://github.com/ismamz/hyperkinetic"
            target="_blank"
            rel="noreferrer"
            aria-label="Hyperkinetic on GitHub"
            className="transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Github />
          </a>
        </nav>
      </div>
    </header>
  );
}
