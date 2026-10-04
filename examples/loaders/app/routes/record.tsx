import { useState } from "react";
import { useLoaderData } from "react-router";

import type { Route } from "./+types/record";

export function loader({ params }: Route.LoaderArgs) {
  const id = params.id ?? "a";
  if (id !== "a" && id !== "b") {
    throw new Response("Record not found", { status: 404 });
  }
  return { id, name: id === "a" ? "Record A" : "Record B" };
}

export default function Record({ loaderData }: Route.ComponentProps) {
  const data = useLoaderData<typeof loader>();
  // Diagnostic only: keep the card's original identity beside the live reads.
  const [mounted] = useState(loaderData.name);

  return (
    <article>
      <h2>Mounted as {mounted}</h2>
      <dl>
        <dt>loaderData prop</dt>
        <dd>{loaderData.name}</dd>
        <dt>useLoaderData()</dt>
        <dd>{data.name}</dd>
      </dl>
    </article>
  );
}
