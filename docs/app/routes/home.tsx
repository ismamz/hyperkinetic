import { useEffect, useState } from "react";

import { readme } from "@/lib/readme.server";

import type { Route } from "./+types/home";

const proseClasses = [
  "prose prose-neutral max-w-none prose-headings:font-normal prose-headings:tracking-normal prose-h1:mt-[calc(3rem+16px)] prose-h1:mb-4 prose-h1:text-lg prose-h1:leading-none prose-h1:font-extralight prose-h1:font-mono prose-h1:uppercase",
  "prose-strong:font-semibold",
  "prose-a:text-neutral-900 prose-a:decoration-neutral-400 prose-a:underline-offset-4 prose-a:transition-colors prose-a:duration-150 prose-a:hover:text-neutral-600 dark:prose-a:text-white dark:prose-a:decoration-neutral-600 dark:prose-a:hover:text-neutral-300",
  "prose-h2:mt-16 prose-h3:mt-10 prose-h3:text-lg prose-h4:mt-8 prose-h4:text-base",
  "prose-p:my-0 prose-p:mb-4 prose-ul:my-0 prose-ul:mb-4 prose-ol:my-0 prose-ol:mb-4 prose-li:my-0 prose-table:block prose-table:w-full prose-table:overflow-x-auto",
  "[&_.github-link]:mb-24",
  "prose-th:border-b prose-th:border-neutral-200 prose-td:border-b prose-td:border-neutral-200",
  "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:border [&_:not(pre)>code]:border-neutral-200 [&_:not(pre)>code]:bg-neutral-100 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:font-normal [&_:not(pre)>code]:text-[0.85em] [&_:not(pre)>code]:before:content-none [&_:not(pre)>code]:after:content-none dark:[&_:not(pre)>code]:border-neutral-800 dark:[&_:not(pre)>code]:bg-neutral-900",
  "[&_pre]:text-[var(--shiki-light)] [&_pre_span]:text-[var(--shiki-light)] dark:[&_pre]:text-[var(--shiki-dark)] dark:[&_pre_span]:text-[var(--shiki-dark)]",
  "dark:prose-invert dark:prose-th:border-neutral-800 dark:prose-td:border-neutral-800",
  "[&_h1+p]:mb-4 [&_h1+p]:text-5xl [&_h1+p]:text-balance [&_h1+p]:font-extralight [&_h1+p]:leading-[1.2] [&_h1+p]:tracking-normal [&_h1+p_a]:font-extralight",
].join(" ");

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
  const [activeId, setActiveId] = useState(toc[0]?.id);

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

  useEffect(() => {
    const headings = toc
      .map(({ id }) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => heading instanceof HTMLElement);
    if (!headings.length) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add((entry.target as HTMLElement).id);
          else visible.delete((entry.target as HTMLElement).id);
        }
        const current = headings.find(({ id }) => visible.has(id));
        if (current) setActiveId(current.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [toc]);

  return (
    <div className="mx-auto grid w-full max-w-[66rem] grid-cols-[minmax(0,46rem)_14rem] gap-16 px-4 pb-32 max-[52rem]:block">
      <nav
        className="sticky top-12 col-start-2 row-start-1 flex h-fit flex-col gap-1.5 text-sm text-neutral-500 max-[52rem]:hidden"
        aria-label="Sections"
      >
        <img className="mb-4 size-15 shrink-0 dark:invert" src="/favicon.svg" alt="" />
        <a
          className="mb-5 inline-flex w-fit items-center gap-1.5 rounded border border-neutral-200 px-5 py-1.5 text-black no-underline hover:bg-neutral-100 dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900"
          href="/basic/"
          target="_blank"
          rel="noreferrer"
        >
          Demo <sup className="top-0 text-xs leading-none" aria-hidden="true">↗</sup>
        </a>
        {toc.map(({ id, text, depth, inlineCode }) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activeId === id ? "location" : undefined}
            className={`transition-colors hover:text-black dark:hover:text-white ${depth === 3 ? "ml-3 text-xs" : ""} ${activeId === id ? "font-medium text-black dark:text-white" : ""}`}
          >
            {inlineCode ? (
              <code className="rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] font-normal dark:border-neutral-800 dark:bg-neutral-900">
                {text}
              </code>
            ) : (
              text
            )}
          </a>
        ))}
        <footer className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800">
          by <a className="text-neutral-900 underline underline-offset-4 transition-colors duration-150 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300" href="https://isma.uy" target="_blank" rel="noreferrer">isma</a>
        </footer>
      </nav>
      <main className="col-start-1 row-start-1 min-w-0" id="top">
        <article
          className={proseClasses}
          dangerouslySetInnerHTML={{ __html: intro + body }}
        />
      </main>
      <footer className="mt-8 hidden border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800 max-[52rem]:block">
        by <a className="text-neutral-900 underline underline-offset-4 transition-colors duration-150 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300" href="https://isma.uy" target="_blank" rel="noreferrer">isma</a>
      </footer>
    </div>
  );
}
