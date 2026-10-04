import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useRef } from "react";

import { usePageTransition } from "hyperkinetic";

import { cn, useIsoLayoutEffect } from "@/lib/utils";

gsap.registerPlugin(SplitText);

export function AnimatedTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const split = useRef<SplitText | null>(null);

  useIsoLayoutEffect(() => {
    if (!title.current) return;
    split.current = SplitText.create(title.current, {
      type: "words",
      mask: "words",
      wordsClass: "title-word",
    });

    return () => {
      split.current?.revert();
      split.current = null;
    };
  }, []);

  usePageTransition({
    group: "outro",
    // The recipe joins the same timeline that crossfades the pages.
    enter: (tl, { reduced }) => {
      const words = split.current?.words;
      if (!words?.length) return;

      tl.fromTo(
        words,
        { yPercent: reduced ? 0 : 130, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: reduced ? 0 : 0.5,
          stagger: reduced ? 0 : 0.04,
          ease: "power3.out",
        },
        "intro",
      );
    },
    leave: (tl, { reduced }) => {
      const words = split.current?.words;
      if (!words?.length) return;

      tl.to(
        words,
        {
          yPercent: reduced ? 0 : -130,
          autoAlpha: 0,
          duration: reduced ? 0 : 0.3,
          stagger: reduced ? 0 : 0.025,
          ease: "power2.in",
        },
        "outro",
      );
    },
  });

  return (
    <h1
      ref={title}
      className={cn(
        "leading-[0.98] tracking-[-0.045em]",
        className ?? "max-w-3xl text-5xl sm:text-7xl lg:text-8xl",
      )}
    >
      {children}
    </h1>
  );
}
