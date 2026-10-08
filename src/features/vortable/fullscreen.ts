import { useEffect, useState } from 'react'

/** Tela cheia do navegador (alguns aparelhos, como o iPhone, não têm). */
export const fullscreenSupported = () => typeof document !== 'undefined' && document.fullscreenEnabled

export function enterFullscreen() {
  if (!fullscreenSupported() || document.fullscreenElement) return
  void document.documentElement.requestFullscreen().catch(() => { /* recusou: fica só a página cheia */ })
}

export function leaveFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
}

export function useIsFullscreen() {
  const [active, setActive] = useState(() => typeof document !== 'undefined' && document.fullscreenElement != null)
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  return active
}
