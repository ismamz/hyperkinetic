import { Link, useLocation } from "react-router";

export function Header() {
  const { pathname } = useLocation();

  return (
    <header>
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          REACT ROUTER + GSAP
        </Link>
        <nav aria-label="Main navigation" className="flex gap-6 text-xs tracking-[0.16em]">
          <Link
            to="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className="transition-opacity hover:opacity-60 aria-[current=page]:underline aria-[current=page]:underline-offset-4"
          >
            INDEX
          </Link>
          <Link
            to="/about"
            aria-current={pathname === "/about" ? "page" : undefined}
            className="transition-opacity hover:opacity-60 aria-[current=page]:underline aria-[current=page]:underline-offset-4"
          >
            NOTES
          </Link>
        </nav>
      </div>
    </header>
  );
}
