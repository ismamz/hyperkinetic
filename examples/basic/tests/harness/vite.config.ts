import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Plain Vite page (no React Router plugin): the harness builds its own memory
// routers. Served from this directory so the example's dependencies resolve
// and its tsconfig (jsx: react-jsx) drives the transform.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // Development mode on purpose: the engine's debug branches are compiled out
  // in production, and the debug checks need them.
  mode: "development",
  server: { port: 5199, strictPort: true, open: false },
  optimizeDeps: { include: ["react", "react-dom/client", "react-router", "gsap", "gsap/GSDevTools"] },
});
