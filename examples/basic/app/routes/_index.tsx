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
          <div className="relative">
            <p className="mb-5 text-xs tracking-[0.2em]">INDEX</p>
            <AnimatedTitle className="max-w-none text-[clamp(3rem,9vw,7.5rem)] leading-[0.9]">
              Page transitions on a{" "}
              <br className="hidden sm:block" />
              single GSAP timeline
            </AnimatedTitle>
            <Link
              to="/about"
              className="group -ml-4 mt-6 inline-flex items-center gap-5 border border-black px-4 py-3 text-xs tracking-[0.16em] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              EXPLORE ABOUT
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
