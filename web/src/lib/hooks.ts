import { useEffect, useRef, useState } from "react";
import type { SseEventDetail } from "../types";

export function useSseEvent(handler: (event: SseEventDetail) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (event: Event): void => {
      const detail = (event as CustomEvent<SseEventDetail>).detail;
      handlerRef.current(detail);
    };
    window.addEventListener("hive:sse", listener);
    return () => window.removeEventListener("hive:sse", listener);
  }, []);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (): void => setMatches(media.matches);
    listener();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}