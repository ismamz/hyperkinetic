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
    <header>
      <div className="container flex items-center justify-between py-8">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Hyperkinetic <span className="font-normal text-black/50">/ Basic</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-6 text-xs tracking-[0.16em]">
          <div ref={links} className="relative flex gap-6">
            <span
              ref={indicator}
              aria-hidden="true"
              className="absolute bottom-1 left-0 h-px bg-black motion-safe:transition-[transform,width] motion-safe:duration-300 motion-safe:ease-out"
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
            className="transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <Github />
          </a>
        </nav>
      </div>
    </header>
  );
}
