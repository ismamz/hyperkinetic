import { createContext } from "react";

import type { PageTransition } from "./types.js";

// Lifecycle phases of ONE page. Incoming goes idle → incoming → entered; the
// outgoing one lives a moment as outgoing before unmounting. useEnterReady reads
// it.
export type PagePhase = "idle" | "incoming" | "entered" | "outgoing";

// Additive registration: every recipe contributes to the provider-owned
// timeline. Returns its own unregister.
export type RegisterFn = (recipe: PageTransition) => () => void;

export type PageTransitionContextValue = {
  phase: PagePhase;
  // Releases the `useEnterReady()` latch before phase reaches "entered". The
  // provider raises it when the global choreography calls `ready()`.
  earlyReady: boolean;
  register: RegisterFn;
};

// Default: outside an AnimatedOutlet a page is always "idle" and register is a
// no-op, so components still work in trees without the provider (tests).
const noopRegister: RegisterFn = () => () => {};

export const PageTransitionContext = createContext<PageTransitionContextValue>({
  phase: "idle",
  earlyReady: false,
  register: noopRegister,
});
