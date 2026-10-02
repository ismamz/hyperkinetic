import assert from "node:assert/strict";
import { test } from "node:test";

import { fallbackFor, fallbackTargets } from "../../dist/fallback.js";
import type { PageTransition } from "../../dist/types.js";

// The selection only reads `children` and `contains`, so a tiny tree stands in
// for the DOM. The browser harness exercises the same algorithm on real nodes.
class Node {
  id: string;
  children: Node[] = [];
  parent: Node | null = null;
  // No parameter property: Node's type stripping rejects that syntax.
  constructor(id: string) {
    this.id = id;
  }
  append(...nodes: Node[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
    return this;
  }
  contains(other: Node): boolean {
    let cursor: Node | null = other;
    while (cursor) {
      if (cursor === this) return true;
      cursor = cursor.parent;
    }
    return false;
  }
}

const el = (id: string) => new Node(id) as unknown as HTMLElement & Node;
const ids = (targets: Element[]) => targets.map((t) => (t as unknown as Node).id);

function tree() {
  // page
  // ├── hero
  // │   ├── title   (scope)
  // │   └── lead
  // ├── list
  // └── footer
  const page = el("page");
  const hero = el("hero");
  const title = el("title");
  const lead = el("lead");
  const list = el("list");
  const footer = el("footer");
  hero.append(title, lead);
  page.append(hero, list, footer);
  return { page, hero, title, lead, list, footer };
}

test("with nothing excluded the whole page container is the single target", () => {
  const { page } = tree();
  assert.deepEqual(ids(fallbackTargets(page, [])), ["page"]);
});

test("a mixed ancestor is never animated: maximal branches without the excluded scope are selected", () => {
  const { page, title } = tree();
  assert.deepEqual(ids(fallbackTargets(page, [title])), ["lead", "list", "footer"]);
});

test("an excluded page container claims everything", () => {
  const { page } = tree();
  assert.deepEqual(ids(fallbackTargets(page, [page])), []);
});

test("directions are chosen independently: callback or false excludes, omission inherits", () => {
  const { page, title, list } = tree();
  const scope = (node: Node) => ({ current: node as unknown as HTMLElement });
  const recipes: PageTransition[] = [
    // Owns leave only; enter inherits the fallback.
    { scope: scope(title), leave: () => {} },
    // Opts out of enter with `false`; leave inherits.
    { scope: scope(list), enter: false },
    // No DOM scope: contributes to the timeline but claims nothing.
    { leave: () => {}, enter: () => {} },
  ];
  const fallback = () => {};
  assert.deepEqual(ids(fallbackFor(fallback, recipes, "leave", page)), ["lead", "list", "footer"]);
  assert.deepEqual(ids(fallbackFor(fallback, recipes, "enter", page)), ["hero", "footer"]);
});

test("a scope whose ref is not attached yet does not exclude anything", () => {
  const { page } = tree();
  const recipes: PageTransition[] = [{ scope: { current: null }, leave: () => {} }];
  assert.deepEqual(ids(fallbackFor(() => {}, recipes, "leave", page)), ["page"]);
});

test("no configured fallback function means no targets", () => {
  const { page } = tree();
  assert.deepEqual(fallbackFor(undefined, [], "enter", page), []);
  assert.deepEqual(fallbackFor(false, [], "enter", page), []);
});
