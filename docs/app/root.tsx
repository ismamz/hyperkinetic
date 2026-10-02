import { Links, Meta, Outlet, Scripts } from "react-router";

import type { Route } from "./+types/root";

import "./globals.css";

export const links: Route.LinksFunction = () => [
  {
    rel: "icon",
    type: "image/svg+xml",
    href: "/favicon.svg",
    media: "(prefers-color-scheme: light)",
  },
  {
    rel: "icon",
    type: "image/svg+xml",
    href: "/favicon-dark.svg",
    media: "(prefers-color-scheme: dark)",
  },
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@200;300&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html className="scroll-smooth scroll-pt-8" lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-white font-sans leading-6 text-black antialiased dark:bg-black dark:text-white">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
