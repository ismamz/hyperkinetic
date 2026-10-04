/// <reference types="gsap" preserve="true" />
import type { RefObject } from "react";

export type PageInfo = {
  container: HTMLElement;
  pathname: string;
};

export type HookData = {
  current: PageInfo;
  next: PageInfo;
  // First load: there is no outgoing page, so `current` is the same page as
  // `next` and the engine runs no exits at all. Everything that reads the
  // outgoing page has to branch on this.
  initial: boolean;
  // The outgoing page was still entering: a newer navigation cut its run. An
  // incoming page that was pinned for the swap goes back to the flow, so
  // anything that depends on its position (the scroll) has to follow.
  interrupted: boolean;
};

export type HookFn = (data: HookData) => void;

// `tl`: the master timeline. The provider creates it paused, every contributor
// writes tweens at a position, and it plays once they are all done.
//
// `ready`: releases the `useEnterReady()` latch on the incoming page before the
// animation ends, so local intros can start while the outgoing page fades out.
// Idempotent, optional.
export type ChoreographData = HookData & {
  tl: gsap.core.Timeline;
  ready: () => void;
  leaveEnd: (group: string) => number;
  reduced: boolean;
};

// The global coordinator: it writes the whole navigation on `data.tl` with the
// GSAP API and publishes the labels every local recipe positions itself at. It
// returns nothing: the provider owns the timeline's lifecycle (play, await,
// kill).
export type ChoreographFn = (data: ChoreographData) => void;

// Global lifecycle hooks. `beforeEnter`/`afterEnter` target the incoming page
// (freeze/reset scroll); `afterEnter` still runs with both pages mounted.
// `after` runs once the outgoing page is gone, before the next paint: the first
// moment the document has its final height.
export type AnimatedOutletProps = {
  choreograph: ChoreographFn;
  debug?: { devTools?: boolean; retainPages?: boolean };
  fallback?: FallbackConfig;
  // First load reuses `choreograph`, the fallback and every local recipe, once.
  // `false` opts out and leaves the first page untouched.
  initial?: boolean;
  resources?: ResourceConfig;
  before?: HookFn;
  beforeEnter?: HookFn;
  afterEnter?: HookFn;
  after?: HookFn;
};

// Default animation for content without its own recipe. The engine picks the
// targets; the application supplies the GSAP code, per direction.
export type FallbackData = PageAnimationData & { targets: Element[] };
export type FallbackFn = (tl: gsap.core.Timeline, data: FallbackData) => void;
export type FallbackConfig = {
  enterAt?: string;
  // Runs on the incoming targets before the first painted frame.
  prepare?: (data: HookData & { targets: Element[] }) => void;
  leave?: FallbackFn | false;
  enter?: FallbackFn | false;
};

// Local recipes contribute to the provider-owned timeline; they never play it.
export type PageAnimationData = HookData & {
  position: number;
  reduced: boolean;
};
export type PageAnimationFn = (tl: gsap.core.Timeline, data: PageAnimationData) => void;
export type PageTransition = {
  scope?: RefObject<HTMLElement | null>;
  group?: string;
  prepare?: HookFn;
  leave?: PageAnimationFn | false;
  enter?: PageAnimationFn | false;
  // Optional label supplied by the global choreography before local enters.
  enterAt?: string;
  // Runs once the master timeline finished and this run is still current.
  // Meant for settling final state that the timeline does not own, such as a
  // persistent scene resuming its idle motion.
  complete?: HookFn;
};

// Explicit, optional readiness. The engine waits only for what was registered,
// and only before playing: both pages stay mounted and the outgoing one visible
// while a resource resolves.
export type ResourceFn = (data: HookData) => unknown;
export type ResourceIssue = {
  reason: "timeout" | "error";
  error?: unknown;
};
export type ResourceConfig = {
  // Safety net, in milliseconds. The engine never waits indefinitely.
  timeout?: number;
  // Reported once per transition; the timeline plays right afterwards, so the
  // application can show its own error or degraded UI.
  onIssue?: (issue: ResourceIssue, data: HookData) => void;
};
