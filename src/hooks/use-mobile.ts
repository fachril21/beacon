import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

const mql = typeof window === "undefined" ? undefined : window.matchMedia(QUERY)

function subscribe(onChange: () => void) {
  mql?.addEventListener("change", onChange)
  return () => mql?.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => mql?.matches ?? false,
    () => false,
  )
}
