/**
 * Como `setInterval`, mas só consulta com a aba à vista. Aba em segundo plano
 * não gasta tráfego do banco; ao voltar, se passou da hora, consulta na hora.
 * Devolve a função que desliga.
 */
export function visibleInterval(fn: () => void, ms: number): () => void {
  let missed = false
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') fn()
    else missed = true
  }, ms)
  const onVisible = () => {
    if (document.visibilityState === 'visible' && missed) { missed = false; fn() }
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
}
