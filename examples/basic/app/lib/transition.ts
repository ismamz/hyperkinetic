import { gsap } from "gsap";

import type { AnimatedOutletProps } from "hyperkinetic";

export const config = {
  // Debug switches, off unless enabled through the environment. Development
  // only: the engine drops them from production builds.
  //   VITE_HYPERKINETIC_DEVTOOLS=1 FILTER=basic pnpm dev:example
  //   VITE_HYPERKINETIC_RETAIN=1 FILTER=basic pnpm dev:example
  debug: {
    devTools: import.meta.env.VITE_HYPERKINETIC_DEVTOOLS === "1",
    retainPages: import.meta.env.VITE_HYPERKINETIC_RETAIN === "1",
  },
  // Skip the hooks and the first-load animation: only navigations animate, so
  // there is always an outgoing and an incoming page and no `!initial` checks.
  initial: false,
  before: () => {
    // Keep the browser from restoring scroll mid-transition on back/forward.
    // The hooks decide when to scroll to the top.
    history.scrollRestoration = "manual";
  },
  beforeEnter: ({ next }) => {
    // Hide the incoming page before its first frame so the fade reveals it.
    // The first load stays visible because `initial: false` skips this hook.
    gsap.set(next.container, { autoAlpha: 0 });
  },
  afterEnter: () => {
    // The outgoing page is invisible and the incoming one still fixed, so the
    // scroll can reset without moving it, before the engine trims the DOM.
    window.scrollTo(0, 0);
  },
  choreograph: ({ tl, current, next, leaveEnd }) => {
    tl.addLabel("outro", 0);

    const duration = 0.6;
    const outroEnd = leaveEnd("outro");
    // The crossfade starts once the grouped local exits have finished.
    tl.to(current.container, { autoAlpha: 0, duration, ease: "none" }, outroEnd);
    tl.to(next.container, { autoAlpha: 1, duration, ease: "none" }, "<");

    tl.addLabel("intro", outroEnd + duration * 0.4);
  },
} satisfies AnimatedOutletProps;
