import { Links, Meta, Scripts } from "react-router";

import { Header } from "@/components/header";
import { config as transition } from "@/lib/transition";
import { AnimatedOutlet } from "@ismamz/hyperkinetic";

import type { Route } from "./+types/root";
import "@/lib/eases";

import "@/globals.css";

// handle 404 and server errors
export { ErrorBoundary } from "@/error";

// global links to be added in the document head
export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
];

// document's "app shell"
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
        {/* off: jumps scroll mid-transition; transition hooks own it (lib/transition.ts) */}
        {/* <ScrollRestoration /> */}
      </body>
    </html>
  );
}

// default, it can be named `Root` if you want
export default function App() {
  return (
    <>
      <Header />
      <AnimatedOutlet {...transition} />
    </>
  );
}
