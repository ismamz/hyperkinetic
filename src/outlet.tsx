import gsap from "gsap";
import type { GSDevTools } from "gsap/GSDevTools";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useLocation, useOutlet } from "react-router";

import { useIsoLayoutEffect } from "./utils.js";

import { PageTransitionContext, type PagePhase, type RegisterFn } from "./context.js";
import { fallbackFor } from "./fallback.js";
import { leaves as buildLeaves } from "./groups.js";
import { persistentRecipes } from "./persistent.js";
import { reducer } from "./reducer.js";
import { collectResources } from "./resources.js";
import type { AnimatedOutletProps, FallbackFn, HookData, PageTransition } from "./types.js";

export function AnimatedOutlet({
  choreograph,
  debug,
  fallback,
  initial,
  resources,
  before,
  beforeEnter,
  afterEnter,
  after,
}: AnimatedOutletProps) {
  const location = useLocation();
  const outlet = useOutlet();

  // Feeds unique keys, one per rendered page.
  const navIdRef = useRef(1);
  // Previous render's outlet. On a route change `outlet` is already the new
  // one, but the outgoing page needs the old tree — this ref holds it.
  const prevOutletRef = useRef<React.ReactNode>(outlet);
  // location.key changes on every navigation, same URL included: real
  // navigations only, no transitions from ordinary re-renders.
  const lastLocKeyRef = useRef(location.key);
  // Current `gen` mirrored in a ref: an in-flight run checks whether a later
  // navigation invalidated it, without reading closure-captured state.
  const genRef = useRef(0);
  // key → the page's real DOM element, filled by the ref callback in the JSX.
  // The hooks hand these containers to the application.
  const containerMapRef = useRef<Map<string, HTMLElement>>(new Map());
  // The finished run whose `after` is due once its trim is committed.
  const afterRef = useRef<{ key: string; data: HookData } | null>(null);
  // key → recipes registered by that page's components.
  const pageRegsRef = useRef<Map<string, Set<PageTransition>>>(new Map());
  // The run whose timeline is not built yet: a recipe that registers for its
  // page meanwhile (a portal, content that resolves during the resource wait)
  // is prepared on the spot instead of painting unprepared until the wait ends.
  const preparingRef = useRef<{ key: string; prepare: (recipe: PageTransition) => void } | null>(
    null,
  );
  const registerFor = useCallback((key: string): RegisterFn => {
    return (recipe) => {
      let set = pageRegsRef.current.get(key);
      if (!set) {
        set = new Set();
        pageRegsRef.current.set(key, set);
      }
      set.add(recipe);
      if (preparingRef.current?.key === key) preparingRef.current.prepare(recipe);
      return () => {
        pageRegsRef.current.get(key)?.delete(recipe);
      };
    };
  }, []);

  // Configuration mirrored in a ref, reassigned every render: effects read the
  // freshest version without depending on it, which would break the gen logic.
  const propsRef = useRef({
    choreograph,
    debug,
    fallback,
    resources,
    before,
    beforeEnter,
    afterEnter,
    after,
  });
  // Before every other layout effect, so each one reads this render's props.
  useIsoLayoutEffect(() => {
    propsRef.current = {
      choreograph,
      debug,
      fallback,
      resources,
      before,
      beforeEnter,
      afterEnter,
      after,
    };
  });

  // One page at rest. The lazy initializer runs exactly once.
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    gen: 0,
    initial: initial !== false,
    interrupted: false,
    pages: [
      {
        // navIdRef starts at 1.
        key: "page-1",
        outlet,
        pathname: location.pathname,
        // Irrelevant at rest (length === 1 decides the phase).
        entered: false,
        earlyReady: false,
      },
    ],
  }));

  // Navigation detector, keyed on `location.key` — the only real trigger. The
  // `lastLocKeyRef` check guards against StrictMode's double invocation. Layout
  // effect, not a plain one: the dispatch lands pre-paint, so the new page is
  // never painted without the old one beside it.
  useIsoLayoutEffect(() => {
    if (lastLocKeyRef.current === location.key) return;
    lastLocKeyRef.current = location.key;
    navIdRef.current += 1;
    genRef.current += 1;
    dispatch({
      type: "NAVIGATE",
      next: {
        key: `page-${navIdRef.current}`,
        outlet,
        pathname: location.pathname,
        entered: false,
        earlyReady: false,
      },
      prevOutlet: prevOutletRef.current,
    });
  }, [location.key]);

  // Refresh the previous-outlet snapshot; the next navigation builds the
  // outgoing page from it.
  useIsoLayoutEffect(() => {
    prevOutletRef.current = outlet;
  }, [outlet]);

  // The one orchestrator, once per navigation (`state.gen`). Layout effect, so
  // the frame with both pages is never painted before the `before` hooks ran.
  // Two effects were merged here: same deps, same container lookup, and the
  // temporal order now reads in a single body.
  useIsoLayoutEffect(() => {
    // First load runs the same choreography with no outgoing page. `state.
    // initial` is the reducer's one-shot flag: the opt-out clears it upfront
    // and the run itself clears it when it finishes.
    const initial = state.pages.length < 2;
    if (initial && !state.initial) return;
    const outgoing = state.pages[0];
    const incoming = state.pages[state.pages.length - 1];
    const nextEl = containerMapRef.current.get(incoming.key);
    const currentEl = initial ? nextEl : containerMapRef.current.get(outgoing.key);
    if (!currentEl || !nextEl) {
      // Never leave the first page latched behind a run that cannot happen.
      if (initial) dispatch({ type: "ENTERED_AND_TRIM", key: incoming.key });
      return;
    }

    // Shared by every phase and immutable for this run: containers do not
    // change once the pages are mounted.
    const baseData = {
      current: { container: currentEl, pathname: outgoing.pathname },
      next: { container: nextEl, pathname: incoming.pathname },
      initial,
      interrupted: state.interrupted,
    };

    // --- before phase: synchronous, pre-paint. ---
    // `before` is generic, `beforeEnter` targets the incoming page (stop
    // scroll, set clip paths). In parallel mode both fire on the same tick.
    propsRef.current.before?.(baseData);
    propsRef.current.beforeEnter?.(baseData);

    // --- enter phase: master timeline, async. ---
    // This run's gen. A navigation mid-animation advances `genRef.current` and
    // `isStale()` turns true.
    const gen = state.gen;
    // Master timeline, created paused so every contributor can insert tweens at
    // a position without racing. Kept for `kill()` in the cleanup.
    let tl: gsap.core.Timeline | null = null;
    let devTools: GSDevTools | null = null;
    // Local signal, set by the cleanup when React unmounts or re-runs.
    let cancelled = false;
    const isStale = () => gen !== genRef.current;

    // Order of a run, one timeline for everything:
    //   1. prepare: persistent recipes, the incoming page's, the fallback's —
    //      before the first painted frame.
    //   2. wait for registered resources, both pages mounted.
    //   3. prepare whatever mounted during that wait.
    //   4. exits: fallback, persistent, local recipes; each group's end
    //      measured.
    //   5. global choreography: its effects and the labels it publishes.
    //   6. entrances: fallback, persistent, local recipes, each at its label.
    //   7. play; then `complete`, afterEnter/after and the trim.
    //
    // `run` is async because it awaits the timeline, and React effects cannot
    // be async themselves.
    const run = async () => {
      // Finish DOM preparation, including StrictMode's effect replay, before
      // capturing tween targets. A replay can replace SplitText's character
      // nodes. A microtask keeps this barrier before the next paint.
      await Promise.resolve();
      if (cancelled || isStale()) return;

      // Releases the `useEnterReady()` latch early. Idempotent and stale-safe:
      // the reducer matches on the last entry's key, so a dead run is a no-op.
      const ready = () => {
        if (cancelled || isStale()) return;
        dispatch({ type: "READY", key: incoming.key });
      };

      tl = gsap.timeline({ paused: true });

      // Components that navigation does not unmount contribute to both
      // directions of every transition, so they are read together with the
      // page's own recipes.
      const contributors = () => [
        ...persistentRecipes(),
        ...Array.from(pageRegsRef.current.get(incoming.key) ?? []),
      ];
      const localOutgoing = initial ? [] : Array.from(pageRegsRef.current.get(outgoing.key) ?? []);
      const animationData = {
        ...baseData,
        position: 0,
        reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
      // Preparation runs after effect replay, before the first painted frame,
      // and again for whatever mounted while a resource was pending.
      const prepared = new Set<PageTransition>();
      const prepareOne = (recipe: PageTransition) => {
        if (prepared.has(recipe)) return;
        prepared.add(recipe);
        recipe.prepare?.(baseData);
      };
      const prepare = () => {
        for (const recipe of contributors()) prepareOne(recipe);
      };
      prepare();
      const preparing = { key: incoming.key, prepare: prepareOne };
      preparingRef.current = preparing;

      // Fallback targets are resolved once per direction, from the registered
      // scopes of each page. Nothing walks the DOM again while the timeline runs.
      // The selection happens before the wait, so a scope registered later does
      // not change it — the Suspense limit already documented for the fallback.
      const fallback = propsRef.current.fallback;
      const leaveTargets = initial
        ? []
        : fallbackFor(fallback?.leave, localOutgoing, "leave", currentEl);
      const enterTargets = fallbackFor(
        fallback?.enter,
        Array.from(pageRegsRef.current.get(incoming.key) ?? []),
        "enter",
        nextEl,
      );
      if (fallback?.prepare && enterTargets.length) {
        fallback.prepare({ ...baseData, targets: enterTargets });
      }
      // Server-rendered markup paints before hydration, so the first page is
      // marked as pending and the application hides it with CSS. Everything is
      // prepared by now, so the mark comes off here, still before the next
      // paint. Removed on the DOM, not through state: a re-render would land a
      // frame later and React never rewrites an attribute it did not change.
      if (initial) nextEl.removeAttribute("data-page-initial");

      // Registered resources gate playback, never mounting: both pages stay
      // in the DOM and the outgoing one visible while they resolve.
      const pending = collectResources(baseData, propsRef.current.resources);
      if (pending) {
        const issue = await pending;
        if (cancelled || isStale()) return;
        if (issue) propsRef.current.resources?.onIssue?.(issue, baseData);
        prepare();
      }

      if (preparingRef.current === preparing) preparingRef.current = null;

      const fallbackLeave: PageTransition[] =
        fallback && typeof fallback.leave === "function" && leaveTargets.length
          ? [
              {
                leave: (timeline, leaveData) =>
                  (fallback.leave as FallbackFn)(timeline, { ...leaveData, targets: leaveTargets }),
              },
            ]
          : [];
      const leaveEnd = buildLeaves(
        tl,
        [...fallbackLeave, ...persistentRecipes(), ...localOutgoing],
        animationData,
      );
      const data = { ...baseData, tl, ready, leaveEnd, reduced: animationData.reduced };

      // Global choreography: its own effects plus the labels that local and
      // fallback entrances resolve against.
      propsRef.current.choreograph(data);
      const at = (label: string | undefined) => {
        const position = label ? tl!.labels[label] : 0;
        if (position === undefined) {
          throw new Error(`Unknown page transition label: ${label}`);
        }
        return position;
      };
      if (fallback && typeof fallback.enter === "function" && enterTargets.length) {
        fallback.enter(tl, {
          ...animationData,
          position: at(fallback.enterAt),
          targets: enterTargets,
        });
      }
      const entering = contributors();
      for (const recipe of entering) {
        if (!recipe.enter) continue;
        recipe.enter(tl, { ...animationData, position: at(recipe.enterAt) });
      }

      if (process.env.NODE_ENV !== "production" && propsRef.current.debug?.devTools) {
        const { GSDevTools } = await import("gsap/GSDevTools");
        if (cancelled || isStale()) return;
        gsap.registerPlugin(GSDevTools);
        devTools = GSDevTools.create({
          animation: tl,
          id: "page-transition",
          css: { zIndex: 9999 },
        });
      }

      // Play and await. With no tweens it resolves immediately, which is the
      // expected behaviour for a page nobody animates.
      tl.play();
      await tl;

      // Guard again after the await: a navigation may have landed mid-animation.
      // A stale run touches neither hooks nor dispatch; the new one owns it.
      if (cancelled || isStale()) return;

      // Components settle their own final state before the global hooks.
      for (const recipe of entering) recipe.complete?.(baseData);
      propsRef.current.afterEnter?.(data);

      if (process.env.NODE_ENV !== "production" && propsRef.current.debug?.retainPages) {
        dispatch({ type: "ENTERED", key: incoming.key });
        return;
      }

      // Atomic: marks the incoming page `entered` AND drops the outgoing one in
      // a single commit, so the data attributes and any CSS bound to them go
      // away in the same frame, without a flash. `after` waits for that commit.
      afterRef.current = { key: incoming.key, data };
      dispatch({ type: "ENTERED_AND_TRIM", key: incoming.key });
    };

    // `void`: the promise is deliberately dropped. Errors and cancellation are
    // handled inside `run` and in the cleanup.
    void run();

    // A new navigation (gen changes → effect re-runs) or an unmount aborts
    // this run.
    return () => {
      cancelled = true;
      if (preparingRef.current?.key === incoming.key) preparingRef.current = null;
      devTools?.kill();
      tl?.kill();
    };
  }, [state.gen]);

  // `after` runs in the commit that removed the outgoing page, before paint. A
  // navigation that lands first drops the trim, and this run's `after` with it.
  useIsoLayoutEffect(() => {
    const pending = afterRef.current;
    if (!pending || state.pages.length !== 1 || state.pages[0].key !== pending.key) return;
    afterRef.current = null;
    propsRef.current.after?.(pending.data);
  }, [state.pages]);

  // Drop registrations of pages that no longer live in the DOM. The
  // entered/earlyReady flags need no pruning: they die with their PageEntry.
  useEffect(() => {
    const liveKeys = new Set(state.pages.map((p) => p.key));
    for (const key of pageRegsRef.current.keys()) {
      if (!liveKeys.has(key)) pageRegsRef.current.delete(key);
    }
  }, [state.pages]);

  return (
    // `data-wrapper` lets external CSS target the container without classes.
    <div data-wrapper="">
      {state.pages.map((p, i) => {
        // More than one page alive means a transition is running.
        const isTransitioning = state.pages.length > 1;
        // NAVIGATE always leaves [outgoing, incoming], so index 0 is the
        // outgoing page and the last one is incoming. At rest there is
        // neither: a single page needs no transition styling.
        const isOutgoing = isTransitioning && i === 0;
        const isIncoming = isTransitioning && i === state.pages.length - 1 && !p.entered;

        // Derived from the position plus the entry's `entered` flag. idle is
        // the resting state.
        let phase: PagePhase;
        // The first page is "incoming" while its own run is pending, so
        // useEnterReady gates initial-load reveals exactly like a navigation.
        if (!isTransitioning) {
          phase = state.initial && !p.entered ? "incoming" : p.entered ? "entered" : "idle";
        } else if (isOutgoing) phase = "outgoing";
        else phase = p.entered ? "entered" : "incoming";

        return (
          <PageProvider
            key={p.key}
            pageKey={p.key}
            phase={phase}
            earlyReady={p.earlyReady}
            registerFor={registerFor}
          >
            <div
              data-page=""
              // The styling API: target the incoming or outgoing page from
              // CSS. On TRIM the attribute disappears in the same render, so
              // the styles lift without a flicker.
              data-page-incoming={isIncoming ? "" : undefined}
              // First load, not prepared yet: see globals.css.
              data-page-initial={state.initial && !p.entered ? "" : undefined}
              data-page-outgoing={isOutgoing ? "" : undefined}
              // Parallel mounting is an engine invariant: only the incoming
              // page may receive focus or interaction during the overlap.
              inert={isOutgoing}
              ref={(el) => {
                // Add and remove the element as React mounts it; the effects
                // read this map to hand out the real containers.
                if (el) containerMapRef.current.set(p.key, el);
                else containerMapRef.current.delete(p.key);
              }}
            >
              {p.outlet}
            </div>
          </PageProvider>
        );
      })}
    </div>
  );
}

type PageProviderProps = {
  pageKey: string;
  phase: PagePhase;
  earlyReady: boolean;
  registerFor: (key: string) => RegisterFn;
  children: React.ReactNode;
};

function PageProvider({ pageKey, phase, earlyReady, registerFor, children }: PageProviderProps) {
  const register = useMemo(() => registerFor(pageKey), [registerFor, pageKey]);
  const value = useMemo(() => ({ phase, earlyReady, register }), [phase, earlyReady, register]);
  return <PageTransitionContext.Provider value={value}>{children}</PageTransitionContext.Provider>;
}
