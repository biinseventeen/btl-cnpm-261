import { useEffect } from 'react'
import { useLocation } from 'react-router'

// The shared layout keeps the scroll position between routes; start each screen at the top.
export function useScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
}
