import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [reactRouter()],
  resolve: { tsconfigPaths: true },
  server: {
    port: 5174,
    strictPort: true,
    // the demo lives at /basic/ in production; in dev it is the basic example's own server
    proxy: { "/basic": { target: "http://localhost:5173", ws: true } },
  },
});
