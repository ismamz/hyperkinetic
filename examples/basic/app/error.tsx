import { isRouteErrorResponse } from "react-router";

import { Header } from "@/components/header";

import type { Route } from "./+types/root";

// https://reactrouter.com/how-to/error-boundary

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Unexpected error";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found" : error.statusText || `Error ${error.status}`;
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
    stack = error.stack;
  }

  return (
    <div className="bg-pattern relative isolate min-h-svh overflow-hidden">
      <Header />

      <h2>{message}</h2>

      {stack && (
        <pre className="mt-8 max-w-[90vw] overflow-x-auto text-left text-xs normal-case">
          <code>{stack}</code>
        </pre>
      )}
    </div>
  );
}
