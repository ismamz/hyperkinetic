# Basic example

Two routes share a page crossfade and a local title recipe. The header remains mounted. First-load transitions are disabled.

From the repository root:

```sh
pnpm install
FILTER=basic pnpm dev:example
FILTER=basic pnpm typecheck:example
FILTER=basic pnpm build:example
```

For a static preview after building:

```sh
pnpm --filter basic exec vite preview
```

`app/lib/transition.ts` defines choreography, scroll hooks and the disabled debug flags. `app/globals.css` defines page positioning. The engine is the root workspace package.

This example preserves the existing motions; it is not a full accessibility or engine edge-case demonstration.
