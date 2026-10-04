import { gsap } from "gsap";
import { AnimatedOutlet, type AnimatedOutletProps } from "hyperkinetic";
import { Link, Links, Meta, Scripts } from "react-router";

import "./style.css";

const transition = {
  initial: false,
  beforeEnter: ({ next }) => {
    gsap.set(next.container, { opacity: 0 });
  },
  choreograph: ({ tl, current, next, reduced }) => {
    const duration = reduced ? 0 : 2;
    tl.to(current.container, { opacity: 0, duration, ease: "none" }, 0);
    tl.to(next.container, { opacity: 1, duration, ease: "none" }, 0);
  },
} satisfies AnimatedOutletProps;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Hyperkinetic · Loaders</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <main>
      <h1>Loader data during a transition</h1>
      <p>Navigate between records. The two cards coexist for two seconds.</p>
      <nav aria-label="Records">
        <Link to="/a">Record A</Link>
        <Link to="/b">Record B</Link>
      </nav>
      <p>The outgoing card should keep its original data until it disappears.</p>
      <AnimatedOutlet {...transition} />
    </main>
  );
}
