// ────────────────────────────────────────────────────────
// Rolagem fluida da barra de abas: animação própria (no lugar do scroll suave do navegador, que não se deixa interromper nem
// acumular), arrastar com o mouse e inércia ao soltar. Sem React; o TabIndicator liga isto à barra.
// Tudo respeita "reduzir movimento": nesse caso a barra anda direto, sem animar.
// ────────────────────────────────────────────────────────

/** Desacelera forte no fim: a barra "pousa" em vez de parar de uma vez. */
export const easeOutQuint = (p: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 5)

/** A distância máxima que a barra pode rolar. */
export const maxScroll = (el: Pick<HTMLElement, 'scrollWidth' | 'clientWidth'>): number => Math.max(0, el.scrollWidth - el.clientWidth)

export const clampScroll = (value: number, max: number): number => Math.min(max, Math.max(0, value))

/** Duração da animação conforme a distância: curta pra pouco, até 620 ms pra muito. */
export const scrollDuration = (distance: number): number => Math.min(620, Math.max(260, 260 + Math.abs(distance) * 0.5))

/** Constante de tempo da inércia (ms): a velocidade cai pela metade a cada ~225 ms. */
export const FLING_TAU = 325
/** Abaixo disto (px por ms) a inércia termina. */
export const FLING_STOP = 0.02
/** Velocidade máxima da inércia (px por ms), pra um arrasto brusco não lançar a barra longe demais. */
export const FLING_MAX = 4

/** Quanto a inércia ainda anda a partir desta velocidade (px por ms): v × tau. */
export const flingDistance = (velocity: number): number => velocity * FLING_TAU

/** Velocidade (px por ms) do dedo ou mouse pelas últimas amostras: a barra anda ao contrário do ponteiro. */
export function releaseVelocity(samples: readonly { t: number; x: number }[], now: number, windowMs = 90): number {
  const recent = samples.filter((s) => now - s.t <= windowMs)
  if (recent.length < 2) return 0
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = last.t - first.t
  if (dt <= 0) return 0
  return Math.max(-FLING_MAX, Math.min(FLING_MAX, -(last.x - first.x) / dt))
}

const reduced = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const running = new WeakMap<HTMLElement, number>()
/** Para onde a barra está indo (acumula cliques seguidos nas setas). */
const goingTo = new WeakMap<HTMLElement, number>()

export function cancelScroll(el: HTMLElement): void {
  const id = running.get(el)
  if (id != null) cancelAnimationFrame(id)
  running.delete(el)
  goingTo.delete(el)
}

/** Anda a barra até `target` com desaceleração suave; uma nova chamada assume de onde a barra está agora. */
export function scrollToSmooth(el: HTMLElement, target: number): void {
  const to = clampScroll(target, maxScroll(el))
  const from = el.scrollLeft
  cancelScroll(el)
  const dist = to - from
  if (Math.abs(dist) < 1) return
  if (reduced()) { el.scrollLeft = to; return }
  goingTo.set(el, to)
  const t0 = performance.now()
  const dur = scrollDuration(dist)
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur)
    el.scrollLeft = from + dist * easeOutQuint(p)
    if (p < 1) running.set(el, requestAnimationFrame(step))
    else { running.delete(el); goingTo.delete(el) }
  }
  running.set(el, requestAnimationFrame(step))
}

/** Anda a barra `delta` a partir de onde ela já está indo (cliques seguidos somam). */
export function scrollByStep(el: HTMLElement, delta: number): void {
  scrollToSmooth(el, (goingTo.get(el) ?? el.scrollLeft) + delta)
}

/** Inércia depois de soltar o arrasto: a velocidade decai de forma exponencial e a barra para sozinha ou ao bater na ponta. */
export function fling(el: HTMLElement, velocity: number): void {
  cancelScroll(el)
  let v = Math.max(-FLING_MAX, Math.min(FLING_MAX, velocity))
  if (Math.abs(v) < FLING_STOP || reduced()) return
  let last = performance.now()
  const step = (now: number) => {
    const dt = Math.min(48, now - last)
    last = now
    const max = maxScroll(el)
    const next = clampScroll(el.scrollLeft + v * dt, max)
    el.scrollLeft = next
    v *= Math.exp(-dt / FLING_TAU)
    if (Math.abs(v) < FLING_STOP || next <= 0 || next >= max) { running.delete(el); return }
    running.set(el, requestAnimationFrame(step))
  }
  running.set(el, requestAnimationFrame(step))
}

/**
 * Arrastar a barra com o mouse (e a caneta; o toque já rola sozinho). Passou de 4 px vira arrasto: a barra acompanha o ponteiro
 * 1 pra 1, o clique que viria depois do arrasto é engolido (senão trocaria de aba sem querer) e, ao soltar, a inércia continua o movimento.
 * Só vale enquanto a barra rola (data-scrolls). Devolve a função que desliga.
 */
export function enableDragScroll(list: HTMLElement): () => void {
  let id: number | null = null
  let startX = 0
  let startScroll = 0
  let dragging = false
  let samples: { t: number; x: number }[] = []

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0 || !list.hasAttribute('data-scrolls')) return
    if ((e.target as HTMLElement | null)?.closest('.tabs-more')) return
    cancelScroll(list)
    id = e.pointerId
    startX = e.clientX
    startScroll = list.scrollLeft
    dragging = false
    samples = [{ t: e.timeStamp, x: e.clientX }]
  }

  const move = (e: PointerEvent) => {
    if (id !== e.pointerId) return
    const dx = e.clientX - startX
    if (!dragging) {
      if (Math.abs(dx) < 4) return
      dragging = true
      list.setPointerCapture(e.pointerId)
      list.setAttribute('data-dragging', '')
    }
    list.scrollLeft = clampScroll(startScroll - dx, maxScroll(list))
    samples.push({ t: e.timeStamp, x: e.clientX })
    if (samples.length > 12) samples.shift()
  }

  const up = (e: PointerEvent) => {
    if (id !== e.pointerId) return
    id = null
    if (!dragging) return
    dragging = false
    list.removeAttribute('data-dragging')
    if (list.hasPointerCapture(e.pointerId)) list.releasePointerCapture(e.pointerId)
    // o clique que o navegador manda logo depois de soltar não pode trocar de aba
    const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
    list.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => list.removeEventListener('click', swallow, { capture: true }), 0)
    fling(list, releaseVelocity(samples, e.timeStamp))
  }

  // roda do mouse ou toque rolando a barra à mão: a animação em curso sai da frente
  const interrupt = () => { if (!dragging) cancelScroll(list) }

  list.addEventListener('pointerdown', down)
  list.addEventListener('pointermove', move)
  list.addEventListener('pointerup', up)
  list.addEventListener('pointercancel', up)
  list.addEventListener('wheel', interrupt, { passive: true })
  list.addEventListener('touchstart', interrupt, { passive: true })
  return () => {
    list.removeEventListener('pointerdown', down)
    list.removeEventListener('pointermove', move)
    list.removeEventListener('pointerup', up)
    list.removeEventListener('pointercancel', up)
    list.removeEventListener('wheel', interrupt)
    list.removeEventListener('touchstart', interrupt)
    list.removeAttribute('data-dragging')
    cancelScroll(list)
  }
}
