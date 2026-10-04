// One entry per page alive in the DOM: two during a navigation (outgoing +
// incoming), one at rest.
// `key`: stable per navigation, used as the React key so React never reuses a
// node across pages.
// `locationKey`: the router navigation this page belongs to. Compared with
// the live `location.key` to decide whether the page still reads live loader
// data or its snapshot.
// `outlet`: the React Router tree frozen for that page.
// `pathname`: handed to the hooks for convenience.
export type PageEntry = {
  key: string;
  locationKey: string;
  outlet: React.ReactNode;
  pathname: string;
  // Entrance finished. Lives in the entry, not in an outside Set, so it dies
  // with the page on TRIM.
  entered: boolean;
  // Early release fired by `ready()`: lifts the `useEnterReady` latch without
  // waiting for the timeline to end.
  earlyReady: boolean;
};

// `pages`: what renders right now.
// `gen`: monotonic counter, one step per navigation. Effect dependency, so a
// run fires once per navigation even when `pages` keeps the same length.
// `initial`: the first load still owes its transition. Cleared when it ends, on
// opt-out, or as soon as a navigation arrives.
// `interrupted`: the last navigation arrived mid-transition, so the page it
// turned into the outgoing one never finished entering.
export type State = { pages: PageEntry[]; gen: number; initial: boolean; interrupted: boolean };

export type Action =
  | {
      type: "NAVIGATE";
      next: PageEntry;
      prevOutlet: React.ReactNode;
    }
  | { type: "READY"; key: string }
  | { type: "ENTERED"; key: string }
  | { type: "ENTERED_AND_TRIM"; key: string };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    // NAVIGATE: array becomes [outgoing, incoming]. The outgoing one is the
    // last entry with its outlet swapped for `prevOutlet`, the tree frozen
    // before React Router re-rendered. Otherwise it would already show the new
    // route, since useOutlet() returns the new one by now.
    case "NAVIGATE": {
      const last = state.pages[state.pages.length - 1];
      return {
        gen: state.gen + 1,
        initial: false,
        interrupted: state.pages.length > 1 && !last.entered,
        pages: [{ ...last, outlet: action.prevOutlet }, { ...action.next }],
      };
    }
    // READY: marks the incoming page early-ready. `ready()` only ever targets
    // the incoming page (= last entry), so no findIndex. Idempotent: already
    // true or a stale key returns the same object, hence no re-render.
    case "READY": {
      const last = state.pages[state.pages.length - 1];
      if (!last || last.key !== action.key || last.earlyReady) return state;
      const pages = state.pages.slice();
      pages[pages.length - 1] = { ...last, earlyReady: true };
      return { ...state, pages };
    }
    case "ENTERED": {
      const last = state.pages[state.pages.length - 1];
      if (last.key !== action.key || last.entered) return state;
      const pages = state.pages.slice();
      pages[pages.length - 1] = { ...last, entered: true };
      return { ...state, pages };
    }
    // ENTERED_AND_TRIM: marks the incoming page `entered` and drops the
    // outgoing one in a single commit. Atomic on purpose: as two updates React
    // gives no batching guarantee after an await.
    case "ENTERED_AND_TRIM": {
      const last = state.pages[state.pages.length - 1];
      if (last.key !== action.key) return state;
      return {
        ...state,
        initial: false,
        pages: [{ ...last, entered: true }],
      };
    }
  }
}
