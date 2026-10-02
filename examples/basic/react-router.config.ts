import type { Config } from "@react-router/dev/config";

export default {
  ssr: false, // no runtime server: static deploy of build/client
  future: {
    // dev: pre-bundle deps from the route modules; otherwise Vite discovers
    // them on first navigation and reloads mid import() (error boundary flash)
    unstable_optimizeDeps: true,
  },
} satisfies Config;
