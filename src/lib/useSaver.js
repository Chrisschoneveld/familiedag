import { useCallback, useEffect, useRef } from 'react'

// Wacht even met opslaan tot iemand klaar is met typen.
export function useSaver(ms = 600) {
  const timers = useRef({})
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])
  return useCallback((key, fn) => {
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(fn, ms)
  }, [ms])
}
