/**
 * Teclado virtual do Vortable: os botões da tela (joystick, correr, interagir) viram os mesmos
 * eventos de tecla que o motor já escuta (setas, Shift, E). Assim nada muda no motor, e uma
 * mecânica nova ligada a uma tecla (o E de interagir, por exemplo) já funciona no celular.
 */

export type VirtualKey = 'up' | 'down' | 'left' | 'right' | 'run' | 'interact'

interface KeyInfo { key: string; code: string; keyCode: number }

const KEYS: Record<VirtualKey, KeyInfo> = {
  up:       { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38 },
  down:     { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40 },
  left:     { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37 },
  right:    { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  run:      { key: 'Shift',      code: 'ShiftLeft',  keyCode: 16 },
  interact: { key: 'e',          code: 'KeyE',       keyCode: 69 },
}

const held = new Set<VirtualKey>()

function fire(type: 'keydown' | 'keyup', name: VirtualKey) {
  const info = KEYS[name]
  const ev = new KeyboardEvent(type, { key: info.key, code: info.code, bubbles: true, cancelable: true })
  // o motor (Phaser) lê `keyCode`, que não entra pelo construtor em todo navegador
  Object.defineProperty(ev, 'keyCode', { get: () => info.keyCode })
  Object.defineProperty(ev, 'which', { get: () => info.keyCode })
  window.dispatchEvent(ev)
}

export function pressKey(name: VirtualKey) {
  if (held.has(name)) return
  held.add(name)
  fire('keydown', name)
}

export function releaseKey(name: VirtualKey) {
  if (!held.delete(name)) return
  fire('keyup', name)
}

export function isHeld(name: VirtualKey) {
  return held.has(name)
}

/** Solta tudo (a aba foi pro fundo, o jogo fechou): o boneco não pode ficar andando sozinho. */
export function releaseAllKeys() {
  for (const name of [...held]) releaseKey(name)
}
