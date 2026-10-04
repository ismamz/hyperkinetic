import { useState } from "react";
import { useLoaderData, useRouteLoaderData } from "react-router";

import { Log, mount, outletProps, waitFor, type Check } from "../support";

type Read = { who: string; mounted: unknown; own: unknown; byId: unknown };

// Records what the route component reads on every render. Reads during the
// render React Router commits before NAVIGATE are the ones that leak, so the
// whole history matters, not just the DOM at the end.
function Probe({ who, reads }: { who: string; reads: Read[] }) {
  const own = useLoaderData() as { id: string } | undefined;
  const byId = useRouteLoaderData("record") as { id: string } | undefined;
  // Which instance this is: the data it mounted with.
  const [mounted] = useState(own?.id);
  reads.push({ who, mounted, own: own?.id, byId: byId?.id });
  return (
    <div>
      <span data-testid={`${who}-own`}>{own?.id ?? "none"}</span>
      <span data-testid={`${who}-by-id`}>{byId?.id ?? "none"}</span>
    </div>
  );
}

// The outgoing page keeps the loader data it had while current. The incoming
// page reads live data, including a revalidation during the overlap.
export const loaders: Check = {
  name: "outgoing page keeps its loader data",
  run: async (t) => {
    const log = new Log();
    const reads: Read[] = [];
    let version = 0;
    const fx = mount({
      routes: {},
      dataRoutes: [
        {
          id: "record",
          path: "/record/:id",
          loader: ({ params }) => ({ id: `${params.id}${version ? `-v${version}` : ""}` }),
          element: <Probe who="record" reads={reads} />,
        },
        {
          id: "other",
          path: "/other",
          loader: () => ({ id: "other" }),
          element: <Probe who="other" reads={reads} />,
        },
      ],
      outlet: outletProps(log, { choreograph: (d) => d.tl.to({}, { duration: 0.3 }) }),
      initialPath: "/record/a",
    });
    const text = (testid: string) =>
      fx.container.querySelector(`[data-testid="${testid}"]`)?.textContent;
    try {
      // A data router runs the initial loader before rendering any route.
      await waitFor(() => fx.pages().length === 1, "initial page");
      t.equal(text("record-own"), "a", "initial page reads its own loader data");

      // Same route id: the live map now holds B under the key A also used.
      await fx.navigate("/record/b");
      await waitFor(() => fx.pages().length === 2, "two pages");
      const [outgoing, incoming] = fx.pages() as [HTMLElement, HTMLElement];
      const read = (el: HTMLElement, suffix: string) =>
        el.querySelector(`[data-testid="record-${suffix}"]`)?.textContent;
      t.equal(read(outgoing, "own"), "a", "outgoing useLoaderData keeps A");
      t.equal(read(outgoing, "by-id"), "a", "outgoing useRouteLoaderData keeps A");
      t.equal(read(incoming, "own"), "b", "incoming useLoaderData reads B");
      t.equal(read(incoming, "by-id"), "b", "incoming useRouteLoaderData reads B");

      // Revalidation during the overlap: B updates, A keeps its snapshot.
      version = 1;
      await fx.router.revalidate();
      await waitFor(() => read(incoming, "own") === "b-v1", "incoming revalidated");
      t.equal(read(outgoing, "own"), "a", "outgoing ignores the revalidation");
      await fx.settled();
      t.equal(text("record-own"), "b-v1", "settled page shows the revalidated data");

      // Different route id: A's entry is gone from the live map entirely.
      await fx.navigate("/other");
      await waitFor(() => fx.pages().length === 2, "two pages");
      const [out2, in2] = fx.pages() as [HTMLElement, HTMLElement];
      t.equal(
        read(out2, "own"),
        "b-v1",
        "outgoing keeps its data when its route id leaves the map",
      );
      t.equal(read(out2, "by-id"), "b-v1", "outgoing useRouteLoaderData keeps its data too");
      t.equal(
        in2.querySelector('[data-testid="other-own"]')?.textContent,
        "other",
        "incoming reads its loader",
      );
      await fx.settled();

      // No render of the A instance ever saw another value, not even the
      // render React Router commits before NAVIGATE marks it outgoing.
      const a = reads.filter((r) => r.mounted === "a");
      t.ok(a.length > 0, "the A instance rendered");
      t.deepEqual(
        a.filter((r) => r.own !== "a" || r.byId !== "a"),
        [],
        "the A instance only ever read A",
      );
      const b = reads.filter((r) => r.mounted === "b");
      t.deepEqual(
        b.filter((r) => r.own !== "b" && r.own !== "b-v1"),
        [],
        "the B instance only ever read B or its revalidation",
      );
    } finally {
      fx.unmount();
    }
  },
};
