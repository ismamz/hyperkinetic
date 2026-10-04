import { useContext, useState, type ReactNode } from "react";
import { UNSAFE_DataRouterDataContext as DataRouterDataContext } from "react-router";

type Props = {
  locationKey: string;
  currentKey: string;
  children: ReactNode;
};

// Re-publishes the last data context a page saw while it was the current
// navigation, so the outgoing page's `useLoaderData()`, `useRouteLoaderData()`
// and `loaderData` prop do not flip to the incoming route mid-transition.
// `UNSAFE_DataRouterDataContext` is what those hooks read in React Router
// 8.4.0, the pinned peer version. `tests/browser/checks/loaders.tsx` guards upgrades.
export function LoaderData({ locationKey, currentKey, children }: Props) {
  const live = useContext(DataRouterDataContext);
  const isCurrent = locationKey === currentKey;
  const [saved, setSaved] = useState(live);

  // Decided during render, not in an effect: the router already delivers the
  // next route's data in the render before NAVIGATE marks this page outgoing,
  // and that render must not reach the page's components.
  if (isCurrent && saved !== live) setSaved(live);

  // No data router (`<BrowserRouter>` and friends): nothing to protect.
  if (!live) return children;
  return (
    <DataRouterDataContext.Provider value={isCurrent ? live : saved}>
      {children}
    </DataRouterDataContext.Provider>
  );
}
