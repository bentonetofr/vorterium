// ────────────────────────────────────────────────────────
// Revelar ao rolar: qualquer elemento com o atributo data-reveal fica
// invisível até entrar na tela e então entra animado (motion.css). Quem
// entra junto na mesma leva ganha um atraso em cascata.
//
// Uso: <section data-reveal> · <div data-reveal="left|right|scale|fade">
//
// Só esconde depois que este arquivo marcou o <html> com a classe
// "reveal-on": sem JavaScript, ou num navegador sem IntersectionObserver,
// tudo aparece normalmente.
// ────────────────────────────────────────────────────────

const SELECTOR = '[data-reveal]:not([data-revealed])'
const STAGGER_MS = 80
const MAX_STAGGER_MS = 480

let installed = false

export function installScrollReveal(): void {
  if (installed || typeof window === 'undefined') return
  if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return
  installed = true

  const reveal = (el: Element, delay: number) => {
    if (delay > 0) (el as HTMLElement).style.setProperty('--reveal-delay', `${delay}ms`)
    el.setAttribute('data-revealed', '')
  }

  const io = new IntersectionObserver((entries) => {
    // Na ordem em que aparecem na página, pra cascata ir de cima pra baixo.
    const entering = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top
        || a.boundingClientRect.left - b.boundingClientRect.left)
    entering.forEach((entry, i) => {
      io.unobserve(entry.target)
      reveal(entry.target, Math.min(i * STAGGER_MS, MAX_STAGGER_MS))
    })
  // Sem margem negativa: um bloco baixo no fim da página precisa conseguir
  // cruzar o limite mesmo sem sobrar rolagem.
  }, { threshold: 0.12 })

  const watch = (root: ParentNode) => {
    if (root instanceof Element && root.matches(SELECTOR)) io.observe(root)
    root.querySelectorAll(SELECTOR).forEach((el) => io.observe(el))
  }

  watch(document)
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => { if (node instanceof Element) watch(node) })
    }
  }).observe(document.body, { childList: true, subtree: true })

  document.documentElement.classList.add('reveal-on')
}
