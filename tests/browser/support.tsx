import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";

import {
  AnimatedOutlet,
  usePageTransition,
  usePersistentTransition,
  type AnimatedOutletProps,
  type PageTransition,
} from "hyperkinetic";

// ---------------------------------------------------------------------------
// Assertions. Each check collects failures instead of throwing on the first
// one, so a single run reports everything that is off.
// ---------------------------------------------------------------------------

export type CheckResult = {
  name: string;
  status: "PASS" | "FAIL";
  failures: string[];
  notes: string[];
  ms: number;
};

export class Expect {
  failures: string[] = [];
  notes: string[] = [];

  ok(condition: unknown, message: string) {
    if (!condition) this.failures.push(message);
  }

  equal<T>(actual: T, expected: T, message: string) {
    if (!Object.is(actual, expected)) {
      this.failures.push(`${message} — expected ${show(expected)}, got ${show(actual)}`);
    }
  }

  deepEqual(actual: unknown, expected: unknown, message: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) this.failures.push(`${message} — expected ${b}, got ${a}`);
  }

  close(actual: number, expected: number, message: string, tolerance = 1e-6) {
    if (Math.abs(actual - expected) > tolerance) {
      this.failures.push(`${message} — expected ≈${expected}, got ${actual}`);
    }
  }

  note(message: string) {
    this.notes.push(message);
  }
}

function show(value: unknown) {
  if (value instanceof Element) return `<${value.tagName.toLowerCase()} ${value.getAttribute("data-testid") ?? ""}>`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export type Check = {
  name: string;
  run: (t: Expect) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Waiting helpers. The engine resolves on GSAP ticks and React commits, so
// polling with a deadline is the only neutral way to wait for either.
// ---------------------------------------------------------------------------

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitFor(predicate: () => boolean, label: string, timeout = 4000) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeout) throw new Error(`Timed out waiting for ${label}`);
    await sleep(16);
  }
}

// One extra React commit + paint, for state the engine dispatches after an await.
export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// ---------------------------------------------------------------------------
// Router fixture. A memory router whose root renders the outlet; the pages are
// plain route elements. Everything is mounted in a fresh container so checks
// never share DOM.
// ---------------------------------------------------------------------------

export type Fixture = {
  container: HTMLElement;
  navigate: (to: string) => Promise<void>;
  // Resolves when the outlet is back to a single page, i.e. the trim committed.
  settled: (timeout?: number) => Promise<void>;
  pages: () => HTMLElement[];
  unmount: () => void;
  rerender: (outlet: Partial<AnimatedOutletProps>) => void;
};

type MountOptions = {
  routes: Record<string, ReactNode>;
  outlet: AnimatedOutletProps;
  // Rendered next to the outlet, inside the router, so it survives navigation.
  persistent?: ReactNode;
  initialPath?: string;
};

export function mount({ routes, outlet, persistent, initialPath }: MountOptions): Fixture {
  const container = document.createElement("div");
  container.className = "fixture";
  document.body.appendChild(container);

  let props = outlet;
  let root: Root | null = createRoot(container);

  const children: RouteObject[] = Object.entries(routes).map(([path, element]) => ({
    path,
    element,
  }));
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Shell persistent={persistent} getProps={() => props} />,
        children,
      },
    ],
    { initialEntries: [initialPath ?? children[0].path!] },
  );

  // Synchronous commit: checks inspect the DOM right after mount/rerender.
  const render = () => flushSync(() => root?.render(<RouterProvider router={router} />));
  render();

  const pages = () => Array.from(container.querySelectorAll<HTMLElement>("[data-page]"));

  return {
    container,
    pages,
    navigate: async (to) => {
      // The router commit is concurrent; the NAVIGATE dispatch lands in a
      // layout effect of that commit and mounts the new page in the next one.
      const before = new Set(pages());
      await router.navigate(to);
      await waitFor(() => pages().some((p) => !before.has(p)), `page for ${to} to mount`);
    },
    settled: (timeout) => waitFor(() => pages().length === 1, "trim to a single page", timeout),
    rerender: (next) => {
      props = { ...props, ...next };
      render();
    },
    unmount: () => {
      root?.unmount();
      root = null;
      container.remove();
    },
  };
}

// Reads the props through a getter so `rerender` can swap them without
// remounting the router.
function Shell({ persistent, getProps }: { persistent?: ReactNode; getProps: () => AnimatedOutletProps }) {
  return (
    <>
      {persistent}
      <AnimatedOutlet {...getProps()} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Logging recipes. Every callback appends `{ who, event, ... }` to a shared
// log so checks can assert order, data and timeline identity.
// ---------------------------------------------------------------------------

export type LogEntry = {
  who: string;
  event: string;
  tl?: gsap.core.Timeline;
  pages?: number;
  [key: string]: unknown;
};

export class Log {
  entries: LogEntry[] = [];
  push(entry: LogEntry) {
    this.entries.push({ ...entry, pages: document.querySelectorAll("[data-page]").length });
  }
  events(who?: string) {
    return this.entries.filter((e) => who === undefined || e.who === who).map((e) => e.event);
  }
  find(who: string, event: string) {
    return this.entries.find((e) => e.who === who && e.event === event);
  }
  all(who: string, event: string) {
    return this.entries.filter((e) => e.who === who && e.event === event);
  }
  timelines() {
    return new Set(this.entries.map((e) => e.tl).filter(Boolean));
  }
}

type RecipeOptions = {
  log: Log;
  who: string;
  duration?: number;
  group?: string;
  enterAt?: string;
  // "omit" leaves the direction undefined so it inherits the fallback.
  leave?: false | "omit" | ((tl: gsap.core.Timeline, el: HTMLElement) => void);
  enter?: false | "omit" | ((tl: gsap.core.Timeline, el: HTMLElement) => void);
  position?: gsap.Position;
  // Omit the DOM scope: the recipe still contributes but claims nothing.
  scopeless?: boolean;
  prepare?: (el: HTMLElement) => void;
};

function recipeFor(scope: React.RefObject<HTMLElement | null>, o: RecipeOptions): PageTransition {
  const duration = o.duration ?? 0.2;
  const recipe: PageTransition = {
    group: o.group,
    enterAt: o.enterAt,
    prepare: (data) => {
      o.log.push({ who: o.who, event: "prepare", ...pick(data) });
      o.prepare?.(scope.current!);
    },
    complete: (data) => o.log.push({ who: o.who, event: "complete", ...pick(data) }),
  };
  if (o.leave === false) recipe.leave = false;
  else if (o.leave !== "omit")
    recipe.leave = (tl, data) => {
      o.log.push({ who: o.who, event: "leave", tl, position: data.position, ...pick(data) });
      if (typeof o.leave === "function") o.leave(tl, scope.current!);
      else tl.to(scope.current, { opacity: 0, duration }, o.position ?? 0);
    };
  if (o.enter === false) recipe.enter = false;
  else if (o.enter !== "omit")
    recipe.enter = (tl, data) => {
      o.log.push({ who: o.who, event: "enter", tl, position: data.position, ...pick(data) });
      if (typeof o.enter === "function") o.enter(tl, scope.current!);
      else tl.fromTo(scope.current, { opacity: 0 }, { opacity: 1, duration }, data.position);
    };
  if (!o.scopeless) recipe.scope = scope;
  return recipe;
}

function pick(data: { initial: boolean; interrupted: boolean; current: { pathname: string }; next: { pathname: string } }) {
  return {
    initial: data.initial,
    interrupted: data.interrupted,
    from: data.current.pathname,
    to: data.next.pathname,
  };
}

// A page component with a logging local recipe.
export function Block(props: RecipeOptions & { children?: ReactNode; testid?: string; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  usePageTransition(recipeFor(scope, props));
  return (
    <div ref={scope} data-testid={props.testid ?? props.who} className={props.className}>
      {props.children ?? props.who}
    </div>
  );
}

// A component that survives navigation, with a logging persistent recipe.
export function Persistent(props: RecipeOptions & { children?: ReactNode; testid?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  usePersistentTransition(recipeFor(scope, props));
  return (
    <div ref={scope} data-testid={props.testid ?? props.who}>
      {props.children ?? props.who}
    </div>
  );
}

// Outlet props whose global hooks log into `log`, with a short crossfade.
export function outletProps(log: Log, overrides: Partial<AnimatedOutletProps> = {}): AnimatedOutletProps {
  const duration = 0.2;
  return {
    initial: false,
    before: (d) => log.push({ who: "outlet", event: "before", ...pick(d) }),
    beforeEnter: (d) => log.push({ who: "outlet", event: "beforeEnter", ...pick(d) }),
    afterEnter: (d) => log.push({ who: "outlet", event: "afterEnter", ...pick(d) }),
    after: (d) => log.push({ who: "outlet", event: "after", ...pick(d) }),
    choreograph: (d) => {
      log.push({
        who: "outlet",
        event: "choreograph",
        tl: d.tl,
        reduced: d.reduced,
        sameContainer: d.current.container === d.next.container,
        ...pick(d),
      });
      d.tl.addLabel("outro", 0);
      if (!d.initial) d.tl.to(d.current.container, { opacity: 0, duration }, 0);
      d.tl.fromTo(d.next.container, { opacity: 0 }, { opacity: 1, duration }, 0);
      d.tl.addLabel("intro", duration / 2);
    },
    ...overrides,
  };
}

// Renders `useEnterReady` transitions into the log on every change.
export function ReadyProbe({ log, who, useEnterReady }: { log: Log; who: string; useEnterReady: () => boolean }) {
  const ready = useEnterReady();
  const last = useRef<boolean | null>(null);
  useEffect(() => {
    if (last.current !== ready) {
      last.current = ready;
      log.push({ who, event: ready ? "ready:true" : "ready:false" });
    }
  });
  return <span data-testid={`${who}-ready`}>{String(ready)}</span>;
}

export { gsap };
