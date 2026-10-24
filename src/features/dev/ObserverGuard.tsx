import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Observer.css'

// ────────────────────────────────────────────────────────
// Conta dev dentro do site dos jogadores (modo observador, ver observer.ts):
// uma faixa avisando que é só leitura e a trava de tela. A trava de verdade é
// a do banco e a do fetch; esta evita que a pessoa digite, marque ou escolha
// algo que não vai ser guardado. Campos de busca continuam livres.
// ────────────────────────────────────────────────────────

const TEXT_FIELDS = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([type=button]):not([type=submit]):not([type=search]), textarea'
const TOGGLES = 'input[type=checkbox], input[type=radio], input[type=range], input[type=file], input[type=color], select'
const FREE = '[data-observer-free]'

function lock(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT_FIELDS).forEach((el) => { if (!el.closest(FREE)) el.readOnly = true })
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(TOGGLES).forEach((el) => { if (!el.closest(FREE)) el.disabled = true })
  root.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach((el) => el.setAttribute('contenteditable', 'false'))
}

export function ObserverGuard() {
  useEffect(() => {
    document.documentElement.setAttribute('data-observer', 'on')
    lock(document.body)
    const watch = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof HTMLElement) { lock(n); if (n.matches(TEXT_FIELDS + ',' + TOGGLES)) lock(n.parentElement ?? document.body) } })
    })
    watch.observe(document.body, { childList: true, subtree: true })
    // Enter dentro de um formulário não tenta enviar nada
    const noSubmit = (e: Event) => e.preventDefault()
    document.addEventListener('submit', noSubmit, true)
    return () => {
      watch.disconnect()
      document.removeEventListener('submit', noSubmit, true)
      document.documentElement.removeAttribute('data-observer')
    }
  }, [])

  return (
    <div className="observer-bar" role="status">
      <span className="observer-bar__dot" aria-hidden="true" />
      <strong>Modo observador</strong>
      <span className="observer-bar__text">Visão do mestre, ao vivo e só leitura: nada do que você tocar é alterado.</span>
      <Link to="/dev/campanhas" className="observer-bar__link">Voltar ao painel dev</Link>
    </div>
  )
}
