# Hyperkinetic

Parallel page transitions for React Router on one shared GSAP timeline.

The outgoing and incoming routes stay mounted together while they animate. Every navigation creates one paused GSAP timeline; the application writes tweens onto it and the engine plays it, waits for it and then removes the outgoing page. The engine owns page lifetimes and timeline playback. The application owns motion, scroll, positioning and layers.

Alpha. React Router and GSAP only; one animated outlet per application.

## Installation

The package is not published to npm. Install a fixed commit from GitHub by writing the pinned specifier in `package.json` and running `pnpm install`:

```json
"dependencies": {
  "@ismamz/hyperkinetic": "github:ismamz/hyperkinetic#<commit-sha>"
}
```

Write it by hand rather than through `pnpm add`: with pnpm 10, `pnpm add '...#<commit-sha>'` records the commit in the lockfile only and saves an unpinned Git URL to `package.json`.

Git installs compile the package through its `prepare` script. pnpm 10 blocks dependency build scripts unless they are allowed, so add this entry to the consuming project's `pnpm-workspace.yaml` before installing, merging it with any existing allowlist, and commit it with the dependency and lockfile:

```yaml
onlyBuiltDependencies:
  - "@ismamz/hyperkinetic"
```

Subsequent clones then install without a separate approval step. No sibling checkout or local link is required.

Peer dependencies: `gsap`, `react` and `react-router`. The engine imports nothing else.

| Peer | Declared range | Verified with |
| --- | --- | --- |
| gsap | `^3.15.0` | 3.15.0 |
| react | `~19.2.8` | 19.2.8 |
| react-router | `8.4.0` | 8.4.0 |

The ranges are not a claim that every version in them was tested.

Inside this repository, `examples/basic` consumes the package through the pnpm workspace:

```sh
pnpm install
pnpm dev
```

## Mounting the outlet

Replace the `<Outlet />` of a layout that stays mounted while its child routes change with `<AnimatedOutlet />`. Render exactly one. Keep navigating with React Router's `Link` and `navigate`. Do not mount `<ScrollRestoration />` next to it: it restores scroll while the outgoing page is still visible, so scroll policy belongs in the lifecycle hooks.

This is `examples/basic` (`app/root.tsx` and `app/lib/transition.ts`, comments shortened):

```tsx
// app/root.tsx
import { AnimatedOutlet } from "@ismamz/hyperkinetic";

import { Header } from "@/components/header";
import { config as transition } from "@/lib/transition";

export default function App() {
  return (
    <>
      <Header />
      <AnimatedOutlet {...transition} />
    </>
  );
}
```

```ts
// app/lib/transition.ts
import { gsap } from "gsap";

import type { AnimatedOutletProps } from "@ismamz/hyperkinetic";

export const config = {
  // Only navigations animate; the first load stays untouched.
  initial: false,
  before: () => {
    history.scrollRestoration = "manual";
  },
  beforeEnter: ({ next }) => {
    // Hide the incoming page before its first frame so the fade reveals it.
    gsap.set(next.container, { autoAlpha: 0 });
  },
  afterEnter: () => {
    // The outgoing page is invisible and the incoming one still fixed.
    window.scrollTo(0, 0);
  },
  choreograph: ({ tl, current, next }) => {
    tl.addLabel("outro");
    const duration = 0.6;
    tl.to(current.container, { autoAlpha: 0, duration, ease: "none" }, "<60%");
    tl.to(next.container, { autoAlpha: 1, duration, ease: "none" }, "<");
    tl.addLabel("intro", "<60%");
  },
} satisfies AnimatedOutletProps;
```

`choreograph` is the only required prop. The scroll calls are application policy, shown because this crossfade needs them.

### Markup and CSS hooks

The engine renders this; you do not write it:

```html
<div data-wrapper>
  <div data-page data-page-outgoing inert>…</div>
  <div data-page data-page-incoming>…</div>
</div>
```

| Attribute | Present when |
| --- | --- |
| `data-wrapper` | Always, on the container of all pages. |
| `data-page` | Always, on every page container. `current.container` and `next.container` in callbacks are these elements. |
| `data-page-outgoing` + `inert` | On the first page while two pages are mounted. |
| `data-page-incoming` | On the last page while two pages are mounted and its entrance has not completed. |
| `data-page-initial` | On the first page from server render until the first run has prepared it. Only when `initial` is enabled. |

At rest a single page carries no transition attribute. Positioning and stacking are yours. `examples/basic` (`app/globals.css`) pins the incoming page so it does not inherit the outgoing scroll:

```css
[data-wrapper] {
  display: grid;
}

[data-page] {
  grid-area: 1 / 1;
}

[data-page-incoming] {
  position: fixed;
  left: 0;
  width: 100%;
  z-index: 2;
}

[data-page-outgoing] {
  pointer-events: none;
}
```

With the first-load transition enabled, server-rendered markup paints before hydration prepares it. If you hide `[data-page-initial]` in CSS, do it inside `@media (scripting: enabled)` so a no-JS document stays readable.

## API

Five runtime exports, plus the types they use:

```ts
import {
  AnimatedOutlet,
  useEnterReady,
  usePageTransition,
  usePersistentTransition,
  useTransitionResource,
} from "@ismamz/hyperkinetic";

import type {
  AnimatedOutletProps,
  ChoreographData,
  ChoreographFn,
  FallbackConfig,
  FallbackData,
  FallbackFn,
  HookData,
  HookFn,
  PageAnimationData,
  PageAnimationFn,
  PageInfo,
  PageTransition,
  ResourceConfig,
  ResourceFn,
  ResourceIssue,
} from "@ismamz/hyperkinetic";
```

### `<AnimatedOutlet />`

| Prop | Type | Notes |
| --- | --- | --- |
| `choreograph` | `(data: ChoreographData) => void` | Required. Writes page-wide motion and labels on `data.tl`. The engine plays the timeline. |
| `fallback` | `FallbackConfig` | Default animation for content without a recipe. Nothing is applied when omitted. |
| `initial` | `boolean` | First load runs the same choreography, fallback and recipes once. `false` opts out. Default: enabled. |
| `resources` | `ResourceConfig` | Timeout and issue reporting for `useTransitionResource`. |
| `before` | `(data: HookData) => void` | Sync, before paint, both pages mounted. |
| `beforeEnter` | `(data: HookData) => void` | Same tick as `before`; by convention targets the incoming page. |
| `afterEnter` | `(data: HookData) => void` | After the timeline finished, both pages still mounted. |
| `after` | `(data: HookData) => void` | In the commit that removed the outgoing page, before paint. |
| `debug` | `{ devTools?: boolean; retainPages?: boolean }` | Development only. See [Debug](#debug). |

Props are read fresh on every run.

### Callback data

| Type | Fields |
| --- | --- |
| `PageInfo` | `container: HTMLElement`, `pathname: string` |
| `HookData` | `current: PageInfo`, `next: PageInfo`, `initial: boolean`, `interrupted: boolean` |
| `PageAnimationData` | `HookData` + `position: number`, `reduced: boolean` |
| `ChoreographData` | `HookData` + `tl: gsap.core.Timeline`, `ready(): void`, `leaveEnd(group: string): number`, `reduced: boolean` |
| `FallbackData` | `PageAnimationData` + `targets: Element[]` |

- `initial`: first load. There is no outgoing page; `current` and `next` are the same page.
- `interrupted`: this navigation cut the previous run, so the page now leaving never finished entering. A pinned incoming page just returned to the flow; scroll usually has to follow.
- `reduced`: `prefers-reduced-motion: reduce` at the start of the run. The engine only reports it.
- `position`: where a recipe places its tweens. `0` for `leave`; for `enter`, the time of its `enterAt` label, or `0`.
- `ready()`: releases the `useEnterReady()` latch on the incoming page before the timeline ends. Idempotent.
- `leaveEnd(group)`: latest end time, in timeline seconds, of the `leave` tweens added by recipes of that group. Unknown or empty groups return `0`.

### Recipes and labels

`usePageTransition(recipe)` and `usePersistentTransition(recipe)` take the same `PageTransition` and differ only in lifetime. A page recipe belongs to the page it renders in: `leave` runs when that page leaves, `enter` when it enters. A persistent recipe belongs to a component navigation never unmounts: `leave` and `enter` run on every transition, in both directions.

| Field | Type | Purpose |
| --- | --- | --- |
| `scope` | `RefObject<HTMLElement \| null>` | Scopes GSAP string selectors in the callbacks and claims that subtree for fallback selection. |
| `group` | `string` | Name whose exit end `leaveEnd(group)` measures. |
| `prepare` | `(data: HookData) => void` | Set the incoming state before paint, before resources are awaited. |
| `leave` | `PageAnimationFn \| false` | Add outgoing tweens. `false` excludes the scope from the fallback for this direction. |
| `enter` | `PageAnimationFn \| false` | Add incoming tweens at `data.position`. `false` excludes the scope from the fallback. |
| `enterAt` | `string` | Label published by `choreograph`. Omitted means time `0`. An unknown label throws. |
| `complete` | `(data: HookData) => void` | After the timeline finished and this run is still current. Called for incoming and persistent recipes. |

Rules:

- Register once per component. The latest callbacks are read when the run needs them.
- Callbacks run inside a `gsap.context` bound to `scope`. String selectors resolve within it; to animate the scope element itself, pass `scope.current`. Everything the callbacks set is reverted when the component unmounts.
- A recipe whose `scope.current` is `null` at run time is skipped.
- `leave` runs before `choreograph`, so labels do not exist yet there. Position exits with `data.position` or a numeric offset. Position entrances with `enterAt`, which the engine resolves and checks.
- Add finite tweens at explicit positions. An infinite tween keeps the run from completing.

A title that exits at once and enters at a label the choreography published, with `group` so the choreography can wait for its real end:

```tsx
import { useRef } from "react";

import { usePageTransition } from "@ismamz/hyperkinetic";

export function Title({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLHeadingElement>(null);

  usePageTransition({
    scope,
    group: "titles",
    enterAt: "titles-in",
    leave: (tl, { position, reduced }) => {
      tl.to(scope.current, { y: -12, autoAlpha: 0, duration: reduced ? 0 : 0.3 }, position);
    },
    enter: (tl, { position, reduced }) => {
      tl.fromTo(
        scope.current,
        { y: 12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: reduced ? 0 : 0.45 },
        position,
      );
    },
  });

  return <h1 ref={scope}>{children}</h1>;
}
```

```ts
choreograph: ({ tl, initial, reduced, leaveEnd, ready }) => {
  const contentStart = initial || reduced ? 0 : 0.15;
  tl.addLabel("content-in", contentStart);
  // Incoming titles wait for the real end of the outgoing ones.
  tl.addLabel("titles-in", Math.max(contentStart, leaveEnd("titles")));
  tl.call(ready, [], contentStart);
},
```

Because `choreograph` runs after exits were added, `tl.duration()` at that point is the end of all exits. This example, together with the fallback and resources configuration below, runs as the `readme` check of `pnpm test:browser`.

### Fallback

`fallback` animates content that declares nothing. The engine picks the targets; the application supplies the GSAP code per direction.

| Field | Type | Notes |
| --- | --- | --- |
| `enterAt` | `string` | Label for the entrance. Unknown labels throw. |
| `prepare` | `(data: HookData & { targets: Element[] }) => void` | Runs on the incoming targets before paint, only when there are targets. |
| `leave` | `FallbackFn \| false` | Receives `targets` of the outgoing page. |
| `enter` | `FallbackFn \| false` | Receives `targets` of the incoming page. |

Target selection, once per run and per direction: the largest branches of the page container that contain no scope whose recipe declares a function or `false` for that direction. Omitting a direction in a recipe inherits the fallback, so the two directions are chosen independently. A recipe without a `scope` excludes nothing. A mixed ancestor is never animated, so its own background, borders and direct text stay static. With no excluded scopes the target is the page container itself.

```ts
fallback: {
  enterAt: "content-in",
  prepare: ({ targets }) => {
    gsap.set(targets, { autoAlpha: 0 });
  },
  leave: (tl, { targets, position, reduced }) => {
    tl.to(targets, { autoAlpha: 0, duration: reduced ? 0 : 0.35 }, position);
  },
  enter: (tl, { targets, position, reduced }) => {
    tl.to(targets, { autoAlpha: 1, duration: reduced ? 0 : 0.7, clearProps: "opacity,visibility" }, position);
  },
},
```

### Resources

`useTransitionResource(load)` declares something every transition waits for before playing. `load(data)` returns a `Promise` while pending and anything else once available. Resources gate playback, not mounting: both pages stay in the DOM and the outgoing one visible while they resolve.

```ts
resources: {
  timeout: 5000, // default
  onIssue: ({ reason, error }, { next }) => {
    console.warn(`Transition to ${next.pathname}: ${reason}`, error);
  },
},
```

| `ResourceIssue.reason` | When |
| --- | --- |
| `"timeout"` | The timeout elapsed first. The engine never waits indefinitely. |
| `"error"` | A promise rejected or a resource function threw. |

An issue is reported once per run through `onIssue`, then the timeline plays. Only values that are `instanceof Promise` are awaited. Declare resources from a component that is already mounted: a suspended one cannot register until it resolves. This is a readiness gate for visual work, not a replacement for React Router loaders.

### Persistent layers

A header, player or canvas rendered beside the outlet uses `usePersistentTransition` with the recipe shape above. Registration is module level, so it also works from another renderer. Persistent recipes contribute to the timeline but never take part in fallback selection. Their `leave` runs on the first load too, since the component is mounted and there is no outgoing page to skip; return early on `data.initial` when needed.

### `useEnterReady()`

A page-local boolean latch for motion that lives outside the shared timeline, such as an idle loop or an intro the page runs itself. It is `true` at rest, becomes `true` when `choreograph` calls `ready()` or when the entrance completes, and stays `true` while the page leaves. Outside an `AnimatedOutlet` it is `true` immediately. Start the local motion in an effect keyed on it.

## Order of a run

```
NAVIGATE (or first load)   both pages mounted; outgoing tagged + inert
→ before(), beforeEnter()  sync, pre-paint
→ prepare()                persistent recipes, incoming page recipes, fallback;
                           data-page-initial removed here
→ await resources          outgoing visible; timeout then onIssue
→ prepare()                anything that registered during the wait
→ exits                    fallback → persistent → outgoing page recipes
→ choreograph()            page-wide effects + labels
→ entrances                fallback → persistent → incoming page recipes
→ play & await tl
→ complete()               incoming and persistent recipes
→ afterEnter()             both pages still mounted
→ trim                     outgoing page removed
→ after()                  pre-paint, the old page is gone
```

**First load.** With `initial` enabled, the first page runs the same choreography once with `initial: true`, `current === next`, and no page or fallback exits. Persistent `leave` callbacks still run. `initial={false}` skips all of it: no hooks, no timeline, and `data-page-initial` is never set.

**Interruption.** The trigger is React Router's `location.key`, so same-path, search-only and hash-only navigations transition too. A navigation during a run kills the active timeline; the stale run calls no `complete`, `afterEnter` or `after`. The page that was entering becomes the new outgoing page and the new run receives `interrupted: true`. The DOM is wherever the killed timeline left it. A navigation during the resource wait is handled the same way, but the resource work itself is not cancelled.

**Server rendering.** Layout effects do not run on the server and the registries stay empty there, so the server renders the first page inside `[data-wrapper] > [data-page]`, with `data-page-initial` when enabled. Hydration runs the first load.

## Debug

```ts
debug: { devTools: true, retainPages: true },
```

Two independent flags, both off when omitted. The guard is `process.env.NODE_ENV !== "production"`, which the consumer's bundler must replace; the package itself does not transform it. With Vite the development build keeps the branches and the production build drops them and the plugin. The panel and retained pages were exercised in `examples/basic` development; the production build was checked with both flags forced on and contains no GSDevTools. The panel has not been exercised from a consumer that installed the package from GitHub.

**`devTools`.** After the entrances are composed and before playback, the engine loads `gsap/GSDevTools` with a dynamic import, registers it and opens a panel bound to the run's timeline (`id: "page-transition"`, `zIndex: 9999`). The run still plays and completes on its own. The panel is destroyed when the next navigation starts or the outlet unmounts. Changing the flag has no effect until the next run. Registering the plugin has global GSAP side effects that killing the panel does not revert, and the plugin ships keyboard shortcuts and session storage of its own. Without `retainPages`, the outgoing page is unmounted when the run completes, so scrubbing afterwards does not reproduce the original transition.

**`retainPages`.** When a run completes, the engine marks the incoming page entered but skips the trim and `after`. Both pages stay mounted until the next navigation or unmount. The incoming page loses `data-page-incoming`, so a fixed incoming page returns to the flow while the outgoing one is still there. The outgoing page keeps `data-page-outgoing` and `inert`. The next navigation is not reported as `interrupted` just because two pages are mounted. Replay only drives the timeline: it does not rewind `prepare`, React state, the `useEnterReady` latch, `complete`, `afterEnter` or intros a page ran on its own. Turning the flag off does not release the retained page immediately.

## Limits

- **One outlet.** Persistent recipes and resources use module-level registries shared by every outlet on the page.
- **Parallel only.** Both pages are alive during the swap. There is no sequential mode.
- **Reduced motion is reported, not applied.** Durations, staggers and label offsets are yours to collapse. The outgoing page is `inert`; focus management and route announcements belong to the application.
- **No positioning or scroll.** The engine adds attributes; the application pins the incoming page, orders layers and resets scroll.
- **Fallback is captured before the resource wait.** Scopes registered later, portals outside the page container and shadow DOM do not change the selection.
- **Resources.** Only `instanceof Promise` values are awaited; a timeout or rejection lets the run continue without cancelling the work.
- **Exceptions.** A callback that throws, including an unknown `enterAt` label or an `onIssue` that throws, rejects the run with no handler. Nothing plays, no completion hook runs and both pages stay mounted until the next navigation. Keep callbacks non-throwing.
- **Property ownership.** One controller per animated property on an element; do not animate the same property from `choreograph`, a recipe and the fallback at once.
- **Coverage.** Verified with `examples/basic` on the versions listed under installation. No other combination is claimed.

## Development

```sh
pnpm install
pnpm dev              # builds the package and runs examples/basic
pnpm typecheck
pnpm typecheck:basic
pnpm test             # unit, browser contract, production debug guard
pnpm build:basic
```

The package lives at the repository root; `src/` compiles to `dist/` as ESM with declarations. Only `dist` is packed.
