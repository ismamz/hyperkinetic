import { useCallback, useRef } from "react";
import { Link } from "react-router";

import { usePageTransition } from "hyperkinetic";

import { AnimatedTitle } from "@/components/animated-title";
import { Footer } from "@/components/footer";
import { useHeroTransition } from "@/lib/hero";

export function meta() {
  return [{ title: "React Router + GSAP — About" }];
}

function useInView() {
  return useCallback((element: Element) => {
    const rect = element.getBoundingClientRect();
    if (rect.right <= 0 || rect.left >= window.innerWidth) return false;

    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    return visibleHeight >= Math.min(rect.height, window.innerHeight) * 0.25;
  }, []);
}

export default function About() {
  const { eyebrow, cta } = useHeroTransition();
  const figures = useRef<HTMLUListElement>(null);
  const inView = useInView();

  usePageTransition({
    scope: figures,
    group: "outro",
    enterAt: "intro",
    leave: (tl, { position, reduced }) => {
      if (!figures.current) return;
      const visible = [...figures.current.children].filter(inView);
      if (!visible.length) return;
      tl.to(
        visible,
        {
          y: reduced ? 0 : -16,
          autoAlpha: 0,
          duration: reduced ? 0 : 0.3,
          stagger: reduced ? 0 : { each: 0.08, from: "end" },
          ease: "power2.in",
        },
        position,
      );
    },
    enter: (tl, { position, reduced }) => {
      if (!figures.current) return;
      const visible = [...figures.current.children].filter(inView);
      if (!visible.length) return;
      tl.fromTo(
        visible,
        { y: reduced ? 0 : 16, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reduced ? 0 : 0.4,
          stagger: reduced ? 0 : 0.08,
          ease: "power2.out",
        },
        position,
      );
    },
  });

  return (
    <>
      <main className="container pt-4 pb-10 sm:pt-6 sm:pb-16">
        <section className="hero-height relative flex flex-col justify-between overflow-hidden bg-black p-7 text-white sm:p-12">
          <div className="relative">
            <p ref={eyebrow} className="mb-5 text-xs tracking-[0.2em]">ABOUT</p>
            <AnimatedTitle>
              Pages move.
              <br />
              The frame stays.
            </AnimatedTitle>
          </div>
          <Link
            ref={cta}
            to="/"
            className="group mt-12 inline-flex self-end items-center gap-5 border border-white px-4 py-3 text-xs tracking-[0.16em] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            GO TO INDEX
            <span className="transition-transform group-hover:-translate-x-1" aria-hidden="true">
              ←
            </span>
          </Link>
        </section>
        <section className="py-20 sm:py-28">
          <h2 className="mb-16 text-center text-2xl font-medium tracking-tight sm:text-3xl">
            Three ways to shape a transition.
          </h2>
          <ul ref={figures} className="grid gap-10 sm:grid-cols-3">
            <li className="flex flex-col items-center gap-6">
              <div aria-hidden="true" className="flex h-52 w-full items-center justify-center">
                <div className="relative h-36 w-56">
                  <div className="absolute top-0 left-0 size-36 rounded-full border-2 border-black" />
                  <div className="absolute top-0 right-0 size-36 rounded-full border-2 border-black" />
                </div>
              </div>
              <span className="text-xs tracking-[0.16em]">CHOREOGRAPHY</span>
              <p className="sr-only">
                Sets the shared timeline, labels and page-wide motion.
              </p>
            </li>
            <li className="flex flex-col items-center gap-6">
              <div aria-hidden="true" className="flex h-52 w-full items-center justify-center">
                <div className="relative h-44 w-52">
                  <div className="absolute top-0 left-0 size-36 border-2 border-black" />
                  <div className="absolute right-0 bottom-0 size-36 border-2 border-black" />
                </div>
              </div>
              <span className="text-xs tracking-[0.16em]">PAGE RECIPES</span>
              <p className="sr-only">
                <code>usePageTransition</code> adds local enter and leave motion.
              </p>
            </li>
            <li className="flex flex-col items-center gap-6">
              <div aria-hidden="true" className="flex h-52 w-full items-center justify-center">
                <div className="triangle-outline">
                  <span />
                </div>
              </div>
              <span className="text-xs tracking-[0.16em]">PERSISTENT RECIPES</span>
              <p className="sr-only">
                <code>usePersistentTransition</code> animates UI that stays mounted.
              </p>
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
