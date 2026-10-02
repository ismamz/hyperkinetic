import type { FallbackFn, PageTransition } from "./types.js";

// Default animation for content that declares nothing. Selection happens once
// per transition and direction: the result is a list of maximal branches of the
// page container that contain no opted-out scope.
//
// A scope opts out of one direction by declaring a callback or `false` for it.
// Omitting a direction inherits the fallback, so the two directions are chosen
// independently.
export function fallbackTargets(container: HTMLElement, excluded: Element[]): Element[] {
  const targets: Element[] = [];
  collect(container, excluded, targets);
  return targets;
}

function collect(node: Element, excluded: Element[], targets: Element[]) {
  if (excluded.includes(node)) return;
  // A mixed ancestor is never animated: opacity or transform on it would reach
  // the excluded scope anyway. Its own background, borders and direct text stay
  // static — the engine does not wrap or move nodes to cover them.
  if (!excluded.some((element) => node.contains(element))) {
    targets.push(node);
    return;
  }
  for (const child of node.children) collect(child, excluded, targets);
}

// Scopes that declare a callback or `false` for this direction own their whole
// subtree; everything else on the page inherits the fallback. A recipe without
// a DOM scope contributes to the timeline but claims nothing.
export function fallbackFor(
  configured: FallbackFn | false | undefined,
  recipes: PageTransition[],
  direction: "leave" | "enter",
  container: HTMLElement,
) {
  if (typeof configured !== "function") return [];
  const excluded: Element[] = [];
  for (const recipe of recipes) {
    const scope = recipe.scope?.current;
    if (scope && recipe[direction] !== undefined) excluded.push(scope);
  }
  return fallbackTargets(container, excluded);
}
