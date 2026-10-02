import { useEffect } from "react";

import { readme } from "@/lib/readme.server";

import type { Route } from "./+types/home";

export async function loader() {
  return readme();
}

export const meta: Route.MetaFunction = () => [
  { title: "Hyperkinetic" },
  {
    name: "description",
    content: "Parallel page transitions for React Router on one shared GSAP timeline.",
  },
];

export default function Home({ loaderData: { intro, body, toc } }: Route.ComponentProps) {
  // buttons are server-rendered; one delegated listener keeps client JS to this
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const button = (e.target as Element).closest<HTMLButtonElement>("[data-copy]");
      const code = button?.parentElement?.querySelector("code");
      if (!button || !code) return;
      await navigator.clipboard.writeText(code.textContent ?? "");
      button.textContent = "copied";
      setTimeout(() => (button.textContent = "copy"), 1500);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="layout">
      <nav className="toc" aria-label="Sections">
        <a href="#top">Hyperkinetic</a>
        {toc.map(({ id, text }) => (
          <a key={id} href={`#${id}`}>
            {text}
          </a>
        ))}
      </nav>
      <main id="top">
        <article className="prose" dangerouslySetInnerHTML={{ __html: intro }} />
        <figure className="demo">
          <iframe src="/basic/" title="Basic example" loading="lazy" />
          <figcaption>
            Basic example · <a href="/basic/">open full</a>
          </figcaption>
        </figure>
        <article className="prose" dangerouslySetInnerHTML={{ __html: body }} />
      </main>
    </div>
  );
}
