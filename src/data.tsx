import { useContext, useState, type ReactNode } from "react";
import { UNSAFE_DataRouterDataContext as DataRouterDataContext } from "react-router";

type Props = {
  locationKey: string;
  currentKey: string;
  children: ReactNode;
};

// The frozen outlet keeps the outgoing page's elements, but its components
// still read React Router's live data context, so `useLoaderData()`,
// `useRouteLoaderData()` and the `loaderData` prop would flip to the incoming
// route mid-transition. This provider re-publishes the last value the page saw
// while it was the current navigation.
//
// Internal API: `UNSAFE_DataRouterDataContext` is what the public hooks read in
// React Router 8.4.0, the version pinned as a peer dependency. Revisit on every
// router upgrade; `tests/browser/checks/loaders.tsx` is the regression.
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
