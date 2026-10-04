import { gsap } from "gsap";
import { AnimatedOutlet, type AnimatedOutletProps } from "hyperkinetic";
import { Link } from "react-router";

const transition = {
  initial: false,
  beforeEnter: ({ next }) => {
    gsap.set(next.container, { opacity: 0 });
  },
  choreograph: ({ tl, current, next }) => {
    const duration = 0.6;
    tl.to(current.container, { opacity: 0, duration }, 0);
    tl.to(next.container, { opacity: 1, duration }, 0);
  },
} satisfies AnimatedOutletProps;

export default function Parent() {
  return (
    <main>
      <h1>Parent layout</h1>
      <nav aria-label="Children">
        <Link to="/">A</Link>
        <Link to="/b">B</Link>
      </nav>
      <AnimatedOutlet {...transition} />
    </main>
  );
}
