import gsap from "gsap";
import { useContext, useRef, useState } from "react";

import { useIsoLayoutEffect } from "./utils.js";

import { PageTransitionContext } from "./context.js";
import { registerPersistent } from "./persistent.js";
import { registerResource } from "./resources.js";
import type { PageTransition, ResourceFn } from "./types.js";

// Boolean latch: true when the page may fire its own intro (idle at rest,
// entered after a transition, or early via `ready()`). Once true it stays true,
// including through "outgoing", so navigating away never cuts an intro short.
export function useEnterReady(): boolean {
  const { phase, earlyReady } = useContext(PageTransitionContext);
  const released = phase === "idle" || phase === "entered" || earlyReady;
  const [ready, setReady] = useState(() => released);
  useIsoLayoutEffect(() => {
    if (released) setReady(true);
  }, [released]);
  return ready;
}

// prepare runs before paint; leave contributes before the global choreography;
// enter contributes afterwards, at enterAt (a global label) or time zero;
// complete settles final state once the timeline finished. The first load runs
// the same recipe, with no leave.
// Register once per page; invoke the latest callbacks after DOM preparation.
export function usePageTransition(recipe: PageTransition) {
  const { register } = useContext(PageTransitionContext);
  useRecipe(recipe, register);
}

// Same recipe, for components that navigation does not unmount. They are not
// bound to a page: their leave and enter run on every transition, in both
// directions, and `complete` closes the run.
export function usePersistentTransition(recipe: PageTransition) {
  useRecipe(recipe, registerPersistent);
}

// Declares something the engine waits for before playing, on every transition.
// Return a promise while the resource is pending and anything else once it is
// available. Declare it from a component that is already mounted: one that is
// still suspended cannot release the wait it causes.
export function useTransitionResource(load: ResourceFn) {
  const ref = useRef(load);
  useIsoLayoutEffect(() => {
    ref.current = load;
  });
  useIsoLayoutEffect(() => registerResource((data) => ref.current(data)), []);
}

function useRecipe(recipe: PageTransition, register: (live: PageTransition) => () => void) {
  const ref = useRef(recipe);
  useIsoLayoutEffect(() => {
    ref.current = recipe;
  });
  useIsoLayoutEffect(() => {
    const scope = recipe.scope;
    const context = gsap.context(() => {});
    const run = (callback: () => void) => {
      if (scope && !scope.current) return;
      context.add(callback, scope?.current ?? undefined);
    };
    const unregister = register({
      scope,
      get group() {
        return ref.current.group;
      },
      get prepare(): PageTransition["prepare"] {
        const fn = ref.current.prepare;
        return (
          fn &&
          ((data) =>
            run(() => {
              fn(data);
            }))
        );
      },
      get leave(): PageTransition["leave"] {
        const fn = ref.current.leave;
        return (
          fn &&
          ((tl, data) =>
            run(() => {
              fn(tl, data);
            }))
        );
      },
      get enter(): PageTransition["enter"] {
        const fn = ref.current.enter;
        return (
          fn &&
          ((tl, data) =>
            run(() => {
              fn(tl, data);
            }))
        );
      },
      get enterAt() {
        return ref.current.enterAt;
      },
      get complete(): PageTransition["complete"] {
        const fn = ref.current.complete;
        return (
          fn &&
          ((data) =>
            run(() => {
              fn(data);
            }))
        );
      },
    });
    return () => {
      unregister();
      // The master timeline was created outside this context: only this
      // component's contributions and preparation styles are reverted.
      context.revert();
    };
  }, [register, recipe.scope]);
}
