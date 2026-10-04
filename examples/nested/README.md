# Nested example

`Outlet` in the root renders a parent layout. Its `AnimatedOutlet` crossfades
between two child routes (`/` and `/b`), while the parent heading and links stay
mounted. First-load transitions are disabled.

From the repository root:

```sh
pnpm install
FILTER=nested pnpm dev:example
FILTER=nested pnpm typecheck:example
```
