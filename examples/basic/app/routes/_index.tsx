import { Link } from "react-router";

import { AnimatedTitle } from "@/components/animated-title";
import { Footer } from "@/components/footer";

export function meta() {
  return [{ title: "React Router + GSAP — Index" }];
}

export default function Home() {
  return (
    <>
      <main className="container pt-4 pb-10 sm:pt-6 sm:pb-16">
        <section className="relative flex min-h-[75vh] flex-col justify-between overflow-hidden border border-black p-7 sm:p-12">
          <div className="absolute -top-40 -right-32 size-96 rounded-full border border-black/20 sm:size-[48rem]" />
          <div className="absolute -top-20 -right-12 size-72 rounded-full border border-black/20 sm:top-0 sm:right-8 sm:size-[36rem]" />
          <div className="relative">
            <p className="mb-5 text-xs tracking-[0.2em]">A SMALL STUDY · 2026</p>
            <AnimatedTitle>Page transitions on a single GSAP timeline</AnimatedTitle>
            <Link
              to="/about"
              className="group mt-8 inline-flex items-center gap-5 border-b border-black pb-2 text-xs tracking-[0.16em]"
            >
              EXPLORE THE NOTES
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <div className="relative flex flex-col gap-8 border-t border-black/30 pt-5 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-sm leading-6 whitespace-nowrap max-sm:whitespace-normal">
              Two pages. One shared timeline. A quiet crossfade between them.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
