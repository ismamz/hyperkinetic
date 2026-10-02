import type { Config } from "@react-router/dev/config";

export default {
  ssr: false, // no runtime server: static deploy of build/client
  // served under /basic/ by the docs site (iframe); keeps asset URLs and routes in that subpath
  basename: "/basic/",
  future: {
    // dev: pre-bundle deps from the route modules; otherwise Vite discovers
    // them on first navigation and reloads mid import() (error boundary flash)
    unstable_optimizeDeps: true,
  },
} satisfies Config;
