<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ismamz/hyperkinetic/main/.github/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/ismamz/hyperkinetic/main/.github/logo.svg">
    <img alt="Hyperkinetic" src="https://raw.githubusercontent.com/ismamz/hyperkinetic/main/.github/logo.svg" width="100">
  </picture>
</p>

<h1 align="center">Hyperkinetic</h1>

<p align="center">Parallel page transitions for <a class="whitespace-nowrap" href="https://reactrouter.com/" target="_blank">React Router</a> on one shared <a href="https://gsap.com/" target="_blank">GSAP</a> timeline.</p>

> [!CAUTION]
> This is an experimental project in alpha stage. Use with caution. API will change.

## Features

* **Parallel**: outgoing and incoming routes stay mounted together while they animate.
* **Single timeline**: every navigation creates one paused GSAP timeline.
* **Clear ownership**: the engine handles lifetimes, you handle motion.
* **Zero dependencies**: React, React Router and GSAP are peer dependencies.

## Installation

**In an existing React Router project:**

```sh
pnpm add hyperkinetic
```

**From scratch:**

Start from a React Router app (Vite), then add GSAP and the engine in one command:

```sh
pnpm create react-router@latest my-app
cd my-app
pnpm add gsap hyperkinetic
```

Peer dependencies: `gsap`, `react` and `react-router`. The engine imports nothing else.

<details>
  <summary>
    <small><strong>Versions</strong>: the ranges are not a claim that every version in them was tested.</small>
  </summary>

  | Peer | Declared range | Verified with |
  | --- | --- | --- |
  | gsap | `^3.15.0` | 3.15.0 |
  | react | `~19.2.8` | 19.2.8 |
  | react-router | `8.4.0` | 8.4.0 |

</details>

## Mounting the outlet

* Replace the [`<Outlet />`](https://reactrouter.com/api/components/Outlet) of a layout with `<AnimatedOutlet />`. Render exactly one.
* Keep navigating with React Router's `Link` and `navigate`.
* Do not mount `<ScrollRestoration />` next to it: scroll policy belongs in the lifecycle hooks.
* Create your `transition.ts` file for global configuration.

This is [`examples/basic`](./examples/basic) (`app/root.tsx` and `app/lib/transition.ts`):

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
> [!NOTE]
> `choreograph` is the only required prop.

### Understanding the markup

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
| `data-page` | Always, on every page container (`current.container` and `next.container`) |
| <code class="whitespace-nowrap">data-page-outgoing</code> | On the first page while two pages are mounted. [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert) for accessibility. |
| `data-page-incoming` | On the last page while two pages are mounted and its entrance has not completed. |
| `data-page-initial` | On the first page from server render until the first run has prepared it. <br/> _Only when `initial` is enabled (the default)._ |

> [!NOTE]
> When idle, a single page has no transition attribute.

## Adding your own styles

Positioning and stacking are yours.

These CSS rules are a starting point. You can use other solutions based on your needs.

```css
/* Ensure incoming and outgoing pages are overlapped. */
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

> [!TIP]
> With the first-load transition enabled (`initial: true`), server-rendered markup paints before hydration prepares it. If you hide `[data-page-initial]` in CSS, do it inside `@media (scripting: enabled)` so a no-JS document stays readable.

## Component animations

### `usePageTransition`

Use `usePageTransition` inside a route component or any child that unmounts with that route. 

The hook registers a local _recipe_ on the same timeline created by `<AnimatedOutlet />`: 

* `leave` contributes while the current page is going out.
* `enter` contributes while the next page is coming in.

```tsx
// app/components/animated-title.tsx

import { useRef } from "react";

import { usePageTransition } from "hyperkinetic";

export function AnimatedTitle({ children }: { children: React.ReactNode }) {
  const title = useRef<HTMLHeadingElement>(null);

  usePageTransition({
    scope: title,
    group: "titles",
    enterAt: "intro",
    leave: (tl) => {
      tl.to(
        title.current,
        {
          y: -20,
          autoAlpha: 0,
          duration: 0.3,
          ease: "power2.in",
        },
        "outro",
      );
    },
    enter: (tl) => {
      tl.fromTo(
        title.current,
        { y: 20, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.45,
          ease: "power2.out",
        },
        "intro",
      );
    },
  });

  return <h1 ref={title}>{children}</h1>;
}
```

### `usePersistentTransition`

Use this hook for UI rendered beside `<AnimatedOutlet />`.

The component stays mounted, so its `leave` and `enter` recipes run on every transition:

```tsx
import { useRef } from "react";
import { usePersistentTransition } from "hyperkinetic";

export function PersistentComponent() {
  const element = useRef<HTMLDivElement>(null);

  usePersistentTransition({
    scope: element,
    leave: (tl) => {
      tl.to(element.current, { y: -8, autoAlpha: 0, duration: 0.2 });
    },
    enter: (tl) => {
      tl.fromTo(
        element.current,
        { y: 8, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.3 },
      );
    },
  });

  return <div ref={element}>Persistent UI</div>;
}
```

## API

The full runtime reference lives in [docs/API.md](https://github.com/ismamz/hyperkinetic/blob/main/docs/API.md).

---

[by isma](https://isma.uy)
