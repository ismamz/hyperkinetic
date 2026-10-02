import { readFile } from "node:fs/promises";

import { Lexer, Marked, type Token, type Tokens } from "marked";
import { codeToHtml } from "shiki";

export type Heading = { id: string; text: string; depth: 2 | 3; inlineCode: boolean };

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * README.md is the single source: the page splits at the first `##` so the
 * opening paragraphs can be laid out separately. Unsupported tokens throw
 * instead of rendering wrong.
 */
export async function readme() {
  // the README centers its header with HTML for GitHub; the site lays it out itself
  const source = (await readFile(new URL("../../../README.md", import.meta.url), "utf8"))
    .replace(/<p align="center">\s*<picture>[\s\S]*?<\/picture>\s*<\/p>/, "")
    .replace(/<h1 align="center">(.*?)<\/h1>/, "# $1")
    .replace(/<p align="center">(.*?)<\/p>/, "$1");
  const md = new Marked({ async: true });
  const all = md.lexer(source);

  // contributor notes stay in the README but not on the site
  const start = all.findIndex(
    (t) => t.type === "heading" && t.depth === 2 && t.text === "Development",
  );
  const end = all.findIndex((t, i) => i > start && t.type === "heading" && t.depth <= 2);
  const tokens = Object.assign(
    start < 0 ? all : [...all.slice(0, start), ...(end < 0 ? [] : all.slice(end))],
    { links: all.links },
  );

  const supported = new Set([
    "heading",
    "paragraph",
    "list",
    "table",
    "code",
    "space",
    "hr",
    "blockquote",
    "html",
  ]);
  for (const t of tokens) {
    if (!supported.has(t.type)) throw new Error(`readme: unsupported block "${t.type}"`);
  }

  const codeTokens = (list: Token[]): Tokens.Code[] =>
    list.flatMap((t) => {
      if (t.type === "code") return [t];
      if ("tokens" in t && Array.isArray(t.tokens)) return codeTokens(t.tokens);
      if (t.type === "list") return t.items.flatMap((item) => codeTokens(item.tokens));
      return [];
    });

  const html = new Map<Tokens.Code, string>();
  await Promise.all(
    codeTokens(tokens).map(async (t) => {
      // fences without a language are diagrams/output: keep them plain
      html.set(
        t,
        await codeToHtml(t.text, {
          lang: t.lang || "text",
          themes: { light: "snazzy-light", dark: "aurora-x" },
          defaultColor: false,
        }),
      );
    }),
  );

  md.use({
    renderer: {
      blockquote(t) {
        const [tag, ...rest] = t.tokens;
        const admonition =
          tag?.type === "paragraph" ? /^\[!(NOTE|INFO|WARNING|CAUTION)\]\s*/.exec(tag.text) : null;
        const text = admonition ? tag.text.slice(admonition[0].length) : "";
        if (
          admonition &&
          (tag.tokens.length === 1 || tag.tokens[0]?.type === "text") &&
          (text || rest.length > 0)
        ) {
          const tone = admonition[1].toLowerCase();
          const toneClasses =
            tone === "info" || tone === "note"
              ? "border-sky-600 dark:border-sky-400"
              : "border-[#806000] dark:border-[khaki]";
          const labelClasses =
            tone === "info" || tone === "note"
              ? "text-sky-700 dark:text-sky-300"
              : "text-[#806000] dark:text-[khaki]";
          const first = text ? [{ ...tag, text, tokens: Lexer.lexInline(text) }] : [];
          return `<aside class="mb-6 flex flex-col gap-2 border-l-2 bg-neutral-100 py-3 ps-5 pe-3 [&_p]:m-0 dark:bg-neutral-950 ${toneClasses}"><p class="font-mono text-xs uppercase ${labelClasses}">${tone}</p>${this.parser.parse([...first, ...rest])}</aside>`;
        }
        return `<blockquote>${this.parser.parse(t.tokens)}</blockquote>`;
      },
      code: (t) =>
        `<div class="group relative mb-6 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-neutral-200 [&_pre]:bg-neutral-50 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[0.8125rem] [&_pre]:leading-relaxed dark:[&_pre]:border-neutral-800 dark:[&_pre]:bg-neutral-950"><button class="js:block absolute right-2 top-2 hidden rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-xs text-neutral-500 uppercase hover:text-black dark:border-neutral-800 dark:bg-black dark:hover:text-white" type="button" data-copy>copy</button>${html.get(t)}</div>`,
      heading(t) {
        const id = slug(t.text);
        if (t.depth === 1) {
          return `<h1 id="${id}">${this.parser.parseInline(t.tokens)}</h1>`;
        }
        return `<h${t.depth} id="${id}">${this.parser.parseInline(t.tokens)}</h${t.depth}>`;
      },
    },
  });

  const split = tokens.findIndex((t) => t.type === "heading" && t.depth === 2);
  const render = (list: Token[]) => md.parser(Object.assign(list, { links: tokens.links }));

  const toc: Heading[] = tokens
    .filter((t): t is Tokens.Heading => t.type === "heading" && (t.depth === 2 || t.depth === 3))
    .map((t) => ({
      id: slug(t.text),
      text: t.tokens
        .map((token) => (token.type === "codespan" || token.type === "text" ? token.text : ""))
        .join(""),
      depth: t.depth,
      inlineCode: t.tokens.some((token) => token.type === "codespan"),
    }));

  const introTokens = tokens.slice(0, split);
  const descriptionIndex = introTokens.findIndex(
    (t) => t.type === "paragraph" && t.text.startsWith("Parallel page transitions for"),
  );
  const demos = `<p class="my-0 flex flex-wrap items-center gap-2" style="margin-block: 48px 90px">
    <a class="inline-flex items-center gap-1.5 rounded border border-neutral-200 px-4 py-1.5 text-sm text-neutral-900 no-underline transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900" href="/basic/" target="_blank" rel="noreferrer">
      Basic demo <span aria-hidden="true">↗</span>
    </a>
    <a class="inline-flex items-center gap-1.5 rounded border border-neutral-200 px-4 py-1.5 text-sm text-neutral-900 no-underline transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900" href="https://amber.isma.uy" target="_blank" rel="noreferrer">
      Amber Demo <span aria-hidden="true">↗</span>
    </a>
  </p>`;
  const intro =
    descriptionIndex < 0
      ? await render(introTokens)
      : `${await render(introTokens.slice(0, descriptionIndex + 1))}${demos}${await render(introTokens.slice(descriptionIndex + 1))}`;

  return {
    intro,
    body: await render(tokens.slice(split)),
    toc,
  };
}
