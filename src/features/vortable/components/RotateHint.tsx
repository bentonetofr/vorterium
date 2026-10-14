import { useEffect, useState } from 'react'
import { isTouchDevice } from '../touch/useTouchMode'
import { useMediaQuery } from '../../../shared/lib/useMediaQuery'
import './RotateHint.css'

const KEY = 'vortable:rotate-hint-dismissed'

/**
 * Aviso pra quem joga no celular em pé: o Vortable foi pensado pra tela deitada (o joystick e os botões
 * ficam nos cantos, e o mundo aparece mais largo). Dá pra continuar em pé; o aviso volta na próxima visita.
 */
export function RotateHint() {
  const portraitPhone = useMediaQuery('(orientation: portrait) and (max-width: 700px)')
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
  })
  const show = portraitPhone && isTouchDevice() && !dismissed

  // virou o celular: o aviso some; se voltar pra em pé, aparece de novo
  useEffect(() => { if (!portraitPhone) setDismissed(false) }, [portraitPhone])

  if (!show) return null
  return (
    <div className="rotate-hint" role="dialog" aria-modal="true" aria-label="Vire o celular">
      <div className="rotate-hint__card">
        <svg className="rotate-hint__icon" viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="20" y="6" width="24" height="42" rx="4" />
          <path d="M30 42h4" />
          <path d="M10 44c0 8 6 14 14 14h14" />
          <path d="M33 52l5 6-5 6" />
        </svg>
        <h2 className="rotate-hint__title">Vire o celular</h2>
        <p className="rotate-hint__text">O Vortable fica melhor com o celular deitado: o mundo aparece mais largo e os botões de andar ficam nos cantos, ao alcance dos polegares.</p>
        <button
          type="button"
          className="btn btn-ghost rotate-hint__skip"
          onClick={() => { try { sessionStorage.setItem(KEY, '1') } catch { /* só pergunta de novo */ } setDismissed(true) }}
        >
          Continuar em pé
        </button>
      </div>
    </div>
  )
}
