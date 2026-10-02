import { useRef } from "react";

import { usePageTransition } from "@ismamz/hyperkinetic";

export function useHeroTransition() {
  const eyebrow = useRef<HTMLParagraphElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);

  usePageTransition({
    group: "outro",
    enterAt: "intro",
    leave: (tl, { position, reduced }) => {
      if (!eyebrow.current || !cta.current) return;
      tl.to(
        [cta.current, eyebrow.current],
        {
          y: reduced ? 0 : -12,
          autoAlpha: 0,
          duration: reduced ? 0 : 0.25,
          stagger: reduced ? 0 : 0.07,
          ease: "power2.in",
        },
        position,
      );
    },
    enter: (tl, { position, reduced }) => {
      if (!eyebrow.current || !cta.current) return;
      tl.fromTo(
        [eyebrow.current, cta.current],
        { y: reduced ? 0 : 12, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reduced ? 0 : 0.45,
          stagger: reduced ? 0 : 0.12,
          ease: "power2.out",
        },
        position,
      );
    },
  });

  return { eyebrow, cta };
}
