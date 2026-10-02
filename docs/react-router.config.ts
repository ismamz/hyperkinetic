import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  // loaders run at build: README is rendered once, the client gets static HTML
  prerender: ["/"],
} satisfies Config;
