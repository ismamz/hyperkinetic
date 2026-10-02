import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Plain Vite page (no React Router plugin): the harness builds its own memory
// routers.
export default defineConfig({
  root: here("."),
  // Development mode on purpose: the engine's debug branches are compiled out
  // in production, and the debug checks need them.
  mode: "development",
  resolve: {
    // The engine is this repo's own package, so its bare specifier has no
    // node_modules entry here. Point it at the built output: that is what the
    // workspace link resolved to when the harness lived in examples/basic, and
    // the test scripts build before running.
    alias: { "hyperkinetic": here("../../dist/index.js") },
  },
  server: { port: 5199, strictPort: true, open: false },
  optimizeDeps: { include: ["react", "react-dom/client", "react-router", "gsap", "gsap/GSDevTools"] },
});
