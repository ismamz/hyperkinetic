<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/logo.svg">
    <img alt="Hyperkinetic" src=".github/logo.svg" width="100">
  </picture>
</p>

<h1 align="center">Hyperkinetic</h1>

<p align="center"><em>Parallel page transitions for <a href="https://reactrouter.com/" target="_blank">React Router</a> on one shared <a href="https://gsap.com/" target="_blank">GSAP</a> timeline.</em></p>

> [!WARNING]
> This is an experimental stage. Use with caution.

## Features

* **Parallel**: outgoing and incoming routes stay mounted together while they animate.
* **Single timeline**: every navigation creates one paused GSAP timeline.
* The engine owns page lifetimes and timeline playback.
* The application owns motion, scroll, positioning and layers.
* **Zero dependencies**: React Router + GSAP are peer dependencies.

## Installation

Start from a React Router app (Vite), then add GSAP and the engine in one command:

```sh
pnpm create react-router@latest my-app
cd my-app
pnpm add gsap hyperkinetic
```

Peer dependencies: `gsap`, `react` and `react-router`. The engine imports nothing else.

| Peer | Declared range | Verified with |
| --- | --- | --- |
| gsap | `^3.15.0` | 3.15.0 |
| react | `~19.2.8` | 19.2.8 |
| react-router | `8.4.0` | 8.4.0 |

<small>The ranges are not a claim that every version in them was tested.</small>

## Mounting the outlet

* Replace the [`<Outlet />`](https://reactrouter.com/api/components/Outlet) of a layout with `<AnimatedOutlet />`. Render exactly one.
* Keep navigating with React Router's `Link` and `navigate`.
* Do not mount `<ScrollRestoration />` next to it: scroll policy belongs in the lifecycle hooks.
* Create your `transition.ts` file for global configuration.

This is `examples/basic` (`app/root.tsx` and `app/lib/transition.ts`):

```tsx
// app/root.tsx
import { AnimatedOutlet } from "hyperkinetic";

import { config as transition } from "@/lib/transition";

export default function App() {
  return (
    <>
      {/* Include your layout elements here… */}
      <AnimatedOutlet {...transition} />
      {/* or here… */}
    </>
  );
}
```

```ts
// app/lib/transition.ts
import { gsap } from "gsap";

import type { AnimatedOutletProps } from "hyperkinetic";

export const config = {
  initial: false, // Only navigations animate, the first load stays untouched.
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
    // Configure your own choreography, add labels or tweens to the timeline (`tl`).
    // `current`: is the outgoing page data, `next`: is the incoming page data.
    tl.addLabel("outro");
    const duration = 0.6;
    tl.to(current.container, { autoAlpha: 0, duration, ease: "none" }, "<60%");
    tl.to(next.container, { autoAlpha: 1, duration, ease: "none" }, "<");
    tl.addLabel("intro", "<60%");
  },
} satisfies AnimatedOutletProps;
```
> [!INFO]
> `choreograph` is the only required prop.

### Markup

The engine renders this, you do not write it:

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
| `data-page-outgoing` | On the first page while two pages are mounted. [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert) for accessibility. |
| `data-page-incoming` | On the last page while two pages are mounted and its entrance has not completed. |
| `data-page-initial` | On the first page from server render until the first run has prepared it. Only when `initial` is enabled. |

> [!INFO]
> At rest a single page carries no transition attribute.

## Styles

> [!WARNING]
> Positioning and stacking are yours.

This CSS rule is a good starting point, but you can use other solutions based on your needs:

```css
/* This CSS rules ensure incoming and outcoming pages are overlapped. */
[data-wrapper] {
  display: grid;
}
[data-page] {
  grid-area: 1 / 1;
}

/* Fix the incoming page, ensure scroll is not taking effect until the full transition ends. */
[data-page-incoming] {
  position: fixed;
  left: 0;
  width: 100%;
  z-index: 2;
}

/* While the transition is happening, the outgoing page should prevent pointer events. */ 
[data-page-outgoing] {
  pointer-events: none;
}
```

With the first-load transition enabled, server-rendered markup paints before hydration prepares it. If you hide `[data-page-initial]` in CSS, do it inside `@media (scripting: enabled)` so a no-JS document stays readable.

## Add enter and leave animation per component

### `usePageTransition`

Use `usePageTransition` inside a route component or any child that unmounts with that route. The hook registers a local recipe on the same timeline created by `<AnimatedOutlet />`: `leave` contributes while the current page is going out, and `enter` contributes while the next page is coming in.

```tsx
import { useRef } from "react";

import { usePageTransition } from "hyperkinetic";

export function AnimatedTitle({ children }: { children: React.ReactNode }) {
  const title = useRef<HTMLHeadingElement>(null);

  usePageTransition({
    scope: title,
    group: "titles",
    enterAt: "intro",
    leave: (tl, { position, reduced }) => {
      tl.to(
        title.current,
        {
          y: -12,
          autoAlpha: 0,
          duration: reduced ? 0 : 0.3,
          ease: "power2.in",
        },
        position,
      );
    },
    enter: (tl, { position, reduced }) => {
      tl.fromTo(
        title.current,
        { y: 12, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reduced ? 0 : 0.45,
          ease: "power2.out",
        },
        position,
      );
    },
  });

  return <h1 ref={title}>{children}</h1>;
}
```

- `scope` keeps selector-based GSAP work local to that component and lets the fallback skip the subtree it owns.
- `group` gives the global choreography a way to
measure when matching exits end with `leaveEnd("titles")`. `enterAt` points the
component entrance at a label published by `choreograph`; if it is omitted, the
entrance starts at `0`.

```ts
choreograph: ({ tl, leaveEnd }) => {
  tl.addLabel("intro", Math.max(0.15, leaveEnd("titles")));
},
```

Use `usePersistentTransition` for components rendered beside the outlet, such as
a header or media player, that should animate on every navigation without
unmounting.

## API

The full runtime reference lives in [docs/API.md](docs/API.md).

---

[by isma](https://isma.uy)
