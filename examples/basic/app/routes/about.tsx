import { Link } from "react-router";

import { AnimatedTitle } from "@/components/animated-title";
import { Footer } from "@/components/footer";

export function meta() {
  return [{ title: "React Router + GSAP — Notes" }];
}

export default function About() {
  return (
    <>
      <main className="container pt-4 pb-10 sm:pt-6 sm:pb-16">
        <section className="relative flex min-h-[75vh] flex-col justify-between overflow-hidden bg-black p-7 text-white sm:p-12">
          <div className="absolute -top-32 -right-32 size-96 rotate-12 border border-white/30 sm:size-[48rem]" />
          <div className="absolute top-8 right-8 size-64 rotate-12 border border-white/30 sm:top-16 sm:right-20 sm:size-[32rem]" />
          <div className="relative">
            <p className="mb-5 text-xs tracking-[0.2em]">THE MECHANISM</p>
            <AnimatedTitle>
              Pages move.
              <br />
              The frame stays.
            </AnimatedTitle>
            <Link
              to="/"
              className="group mt-8 inline-flex items-center gap-5 border-b border-white pb-2 text-xs tracking-[0.16em]"
            >
              GO TO INDEX
              <span className="transition-transform group-hover:-translate-x-1" aria-hidden="true">
                ←
              </span>
            </Link>
          </div>
          <div className="relative border-t border-white/30 pt-5">
            <p className="text-sm leading-6 whitespace-nowrap max-sm:whitespace-normal">
              The outgoing page holds its place as the next one fades into view.
            </p>
          </div>
        </section>
        <section className="py-20 sm:py-28">
          <h2 className="mb-8 text-2xl font-medium tracking-tight sm:text-3xl">
            Three ways to shape a transition.
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            <li className="border border-black p-6 sm:p-8">
              <span className="text-xs tracking-[0.16em]">01 / CHOREOGRAPHY</span>
              <p className="mt-12 text-lg leading-snug">
                Sets the shared timeline, labels and page-wide motion.
              </p>
            </li>
            <li className="border border-black p-6 sm:p-8">
              <span className="text-xs tracking-[0.16em]">02 / PAGE RECIPES</span>
              <p className="mt-12 text-lg leading-snug">
                <code>usePageTransition</code> adds local enter and leave motion.
              </p>
            </li>
            <li className="border border-black p-6 sm:p-8">
              <span className="text-xs tracking-[0.16em]">03 / PERSISTENT RECIPES</span>
              <p className="mt-12 text-lg leading-snug">
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
