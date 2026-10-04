# Loaders example

One dynamic route, two records, one server `loader`, and a two-second crossfade.
The outgoing and incoming cards sit side by side so their data can be inspected.
No API, database, or loader-data preservation workaround.

From the repository root:

```sh
pnpm install
FILTER=loaders pnpm dev:example
FILTER=loaders pnpm typecheck:example
```

Open the dev-server URL (`/` defaults to record A). Navigate between `/a` and `/b`.
Each card shows its identity at mount, its `loaderData` prop, and `useLoaderData()`.
The mount identity is only a diagnostic: the displayed loader values remain live.

During A → B, the outgoing card should show A in all three places, and the incoming
card should show B. If either loader value changes on the outgoing card, the router
data is not preserved by retaining the old outlet. Also try B → A and browser Back.

Reduced motion skips the animation. SSR stays enabled to exercise a real server
loader on both initial requests and client navigation.

## Observed result

Verified on 2026-10-04 against Hyperkinetic `a34546d` with React Router 8.4.0:
A → B, B → A, and browser Back all complete, but the outgoing card's `loaderData`
and `useLoaderData()` switch to the incoming record. Its mount identity stays old.
This example reproduces the data-preservation issue; it does not fix it.
