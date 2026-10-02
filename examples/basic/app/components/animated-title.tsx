import { useRef } from "react";

import { usePageTransition } from "@ismamz/hyperkinetic";

export function AnimatedTitle({ children }: { children: React.ReactNode }) {
  const title = useRef<HTMLHeadingElement>(null);

  usePageTransition({
    // La receta se suma al mismo timeline que hace el crossfade de las páginas.
    enter: (tl) => {
      tl.fromTo(
        title.current,
        { y: 12, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.45,
          ease: "power2.out",
        },
        "intro",
      );
    },
    leave: (tl) => {
      tl.to(
        title.current,
        {
          y: -12,
          autoAlpha: 0,
          duration: 0.45,
          ease: "power2.in",
        },
        "outro",
      );
    },
  });

  return (
    <h1
      ref={title}
      className="max-w-3xl text-5xl leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-8xl"
    >
      {children}
    </h1>
  );
}
