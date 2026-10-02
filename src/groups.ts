import type gsap from "gsap";

import type { PageAnimationData, PageTransition } from "./types.js";

export function leaves(tl: gsap.core.Timeline, recipes: PageTransition[], data: PageAnimationData) {
  const ends = new Map<string, number>();
  for (const recipe of recipes) {
    if (!recipe.leave) continue;
    const group = recipe.group;
    const previous = group === undefined ? null : new Set(tl.getChildren(false));
    recipe.leave(tl, data);
    if (group === undefined || !previous) continue;
    let end = ends.get(group) ?? 0;
    // Measure only this contribution, in master-timeline coordinates.
    for (const animation of tl.getChildren(false)) {
      if (!previous.has(animation)) end = Math.max(end, animation.endTime());
    }
    ends.set(group, end);
  }
  return (group: string) => ends.get(group) ?? 0;
}
