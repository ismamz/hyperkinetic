# Loaders example

One dynamic route, two records, one server `loader`, and a two-second crossfade.
The outgoing and incoming cards sit side by side so their data can be inspected.
No API, database, or application-side workaround: the engine keeps the outgoing
page's loader data on its own.

From the repository root:

```sh
pnpm install
FILTER=loaders pnpm dev:example
FILTER=loaders pnpm typecheck:example
```

Open the dev-server URL (`/` defaults to record A). Navigate between `/a` and `/b`.
Each card shows its identity at mount, its `loaderData` prop, and `useLoaderData()`.
The mount identity is only a diagnostic: the displayed loader values remain live.

During A → B, the outgoing card shows A in all three places and the incoming card
shows B. Without the engine's loader-data snapshot, both loader values on the
outgoing card would flip to B: the retained tree still reads React Router's live
data context. Also try B → A, browser Back, and a second click mid-transition.

Reduced motion skips the animation. SSR stays enabled to exercise a real server
loader on both initial requests and client navigation.

## Observed result

Verified on 2026-10-04 against React Router 8.4.0, SSR enabled, with the fix in
`src/data.tsx`: A → B, B → A, browser Back and an interrupted A → B → A all keep the
outgoing card on its own record in both reads while the incoming card shows the new
one. No console or hydration errors. Before the fix, the outgoing card's `loaderData`
prop and `useLoaderData()` switched to the incoming record while its mount identity
stayed old.
