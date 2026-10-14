import { useCallback, useEffect, useState } from 'react'

/**
 * Controles na tela do Vortable (joystick e botões). Ligam sozinhos em aparelho de toque
 * (o dedo é o ponteiro principal: celular e tablet). `?touch=1` / `?touch=0` na página força
 * ligado/desligado (fica guardado); `?touch=auto` volta ao automático. O botão do olho nos
 * controles também liga e desliga (um tablet com teclado não precisa do joystick).
 */
const KEY = 'vortable:touch'
const EVENT = 'vortable:touch-pref'

type Pref = 'on' | 'off' | 'auto'

function readPref(): Pref {
  try {
    const v = new URLSearchParams(window.location.search).get('touch')
    if (v === '1' || v === 'on') localStorage.setItem(KEY, 'on')
    else if (v === '0' || v === 'off') localStorage.setItem(KEY, 'off')
    else if (v === 'auto') localStorage.removeItem(KEY)
    const stored = localStorage.getItem(KEY)
    return stored === 'on' || stored === 'off' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

/** O aparelho é de toque (o dedo é o ponteiro principal)? */
export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

function resolve(pref: Pref) {
  return pref === 'auto' ? isTouchDevice() : pref === 'on'
}

/**
 * `touch`: mostra os controles agora. `canShow`: o aparelho é de toque ou foi forçado; mesmo com os
 * controles escondidos sobra o botãozinho pra trazer de volta.
 */
export function useTouchMode(): { touch: boolean; canShow: boolean; setTouch: (on: boolean) => void } {
  const [touch, setTouchState] = useState(() => resolve(readPref()))

  useEffect(() => {
    const sync = () => setTouchState(resolve(readPref()))
    const mq = window.matchMedia('(pointer: coarse)')
    mq.addEventListener('change', sync)
    window.addEventListener(EVENT, sync)
    return () => { mq.removeEventListener('change', sync); window.removeEventListener(EVENT, sync) }
  }, [])

  const setTouch = useCallback((on: boolean) => {
    try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* só não lembra */ }
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { touch, canShow: touch || isTouchDevice(), setTouch }
}
