// ────────────────────────────────────────────────────────
// Espaço não aperta botão nenhum no site. Por padrão, o navegador "clica"
// no botão que está com o foco quando a pessoa aperta Espaço — e o foco fica
// no último botão clicado, então um Espaço depois (pra arrastar o Quadro,
// por exemplo) repetia aquele botão. Aqui o Espaço só é cancelado quando o
// foco está num botão (ou algo que faz papel de botão); em campo de texto ele
// continua escrevendo espaço, e os atalhos com Espaço (como arrastar o
// Quadro) continuam funcionando. O Enter segue apertando botões normalmente.
// ────────────────────────────────────────────────────────

const BUTTON_LIKE = [
  'button', 'summary',
  'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
  'input[type="checkbox"]', 'input[type="radio"]', 'input[type="color"]', 'input[type="file"]',
  '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="menuitemradio"]', '[role="menuitemcheckbox"]',
  '[role="option"]', '[role="switch"]', '[role="checkbox"]', '[role="radio"]', '[role="combobox"]',
].join(', ')

const TEXT_ENTRY = 'textarea, select, input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):not([type="range"])'

function blockSpace(e: KeyboardEvent) {
  if (e.key !== ' ' && e.code !== 'Space') return
  const t = e.target
  if (!(t instanceof Element)) return
  if ((t instanceof HTMLElement && t.isContentEditable) || t.closest(TEXT_ENTRY)) return
  if (t.closest(BUTTON_LIKE)) e.preventDefault()
}

let installed = false

/** Liga a proteção uma vez (no início do app). */
export function installNoSpaceActivation(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  // Na captura, antes de qualquer coisa: o navegador clica no soltar (keyup).
  window.addEventListener('keydown', blockSpace, true)
  window.addEventListener('keyup', blockSpace, true)
}
