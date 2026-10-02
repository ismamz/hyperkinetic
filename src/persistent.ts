import type { PageTransition } from "./types.js";

// Components that survive navigation live outside the outlet — the canvas is
// mounted next to it, in another renderer — so they cannot reach the page
// context. Registration is module level instead of a provider above both
// trees: it crosses the React Three Fiber boundary without relying on context
// bridging, and it stays empty on the server, where no layout effect runs.
const recipes = new Set<PageTransition>();

export function registerPersistent(recipe: PageTransition) {
  recipes.add(recipe);
  return () => {
    recipes.delete(recipe);
  };
}

// Snapshot in registration order, taken once per transition.
export function persistentRecipes() {
  return Array.from(recipes);
}
