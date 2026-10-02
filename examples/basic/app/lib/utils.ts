import { useEffect, useLayoutEffect } from "react";

export { cn } from "cn";

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
