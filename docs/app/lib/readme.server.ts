import { readFile } from "node:fs/promises";

import { Marked, type Token, type Tokens } from "marked";
import { codeToHtml } from "shiki";

export type Heading = { id: string; text: string };

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * README.md is the single source: the page splits at the first `##` so the demo
 * sits under the opening paragraphs. Unsupported tokens throw instead of
 * rendering wrong.
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
  const start = all.findIndex((t) => t.type === "heading" && t.depth === 2 && t.text === "Development");
  const end = all.findIndex((t, i) => i > start && t.type === "heading" && t.depth <= 2);
  const tokens = Object.assign(
    start < 0 ? all : [...all.slice(0, start), ...(end < 0 ? [] : all.slice(end))],
    { links: all.links },
  );

  const supported = new Set(["heading", "paragraph", "list", "table", "code", "space", "hr"]);
  for (const t of tokens) {
    if (!supported.has(t.type)) throw new Error(`readme: unsupported block "${t.type}"`);
  }

  const html = new Map<Tokens.Code, string>();
  await Promise.all(
    tokens
      .filter((t): t is Tokens.Code => t.type === "code")
      .map(async (t) => {
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
      code: (t) => `<div class="code"><button type="button" data-copy>copy</button>${html.get(t)}</div>`,
      heading(t) {
        const id = slug(t.text);
        return `<h${t.depth} id="${id}">${this.parser.parseInline(t.tokens)}</h${t.depth}>`;
      },
    },
  });

  const split = tokens.findIndex((t) => t.type === "heading" && t.depth === 2);
  const render = (list: Token[]) => md.parser(Object.assign(list, { links: tokens.links }));

  const toc: Heading[] = tokens
    .filter((t): t is Tokens.Heading => t.type === "heading" && t.depth === 2)
    .map((t) => ({ id: slug(t.text), text: t.text }));

  return {
    intro: await render(tokens.slice(0, split)),
    body: await render(tokens.slice(split)),
    toc,
  };
}
