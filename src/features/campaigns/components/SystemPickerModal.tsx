import { useEffect, useRef, useState } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { STATUS_LABELS, getSystemVariants, type SystemEntry } from '../../../shared/constants/systems'
import type { CampaignSystem } from '../../../shared/types'
import './SystemPickerModal.css'

interface SystemPickerModalProps {
  systems:  SystemEntry[]
  /** Sistema escolhido agora (a variante conta pro cartão do sistema de origem). */
  current:  CampaignSystem | null
  guarded?: CampaignSystem[]
  onPick:   (system: SystemEntry) => void
  onClose:  () => void
}

/**
 * Janela grande no centro da tela com um cartão por sistema (arte, nome e descrição), três por linha, rolando pra baixo.
 * Clicar num cartão marca o sistema com uma animação e fecha a janela (ou abre a escolha de versão, no Terra Devastada).
 */
export function SystemPickerModal({ systems, current, guarded = [], onPick, onClose }: SystemPickerModalProps) {
  const [picked, setPicked] = useState<CampaignSystem | null>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { firstRef.current?.focus({ preventScroll: true }); return () => window.clearTimeout(timer.current) }, [])

  function choose(sys: SystemEntry) {
    if (picked) return
    setPicked(sys.id)
    // dá tempo da animação de marcar antes de fechar (ou de abrir a escolha de versão)
    timer.current = window.setTimeout(() => { setPicked(null); onPick(sys) }, 380)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="sysmodal" role="dialog" aria-modal="true" aria-labelledby="sysmodal-title">
        <header className="sysmodal__header">
          <div>
            <h3 id="sysmodal-title" className="sysmodal__title">Escolha o sistema da campanha</h3>
            <p className="sysmodal__hint">É ele que define a ficha, as regras e o visual da sua mesa.</p>
          </div>
          <button type="button" className="modal-close sysmodal__close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="sysmodal__scroll">
          <div className="sysmodal__grid" role="radiogroup" aria-label="Sistemas">
            {systems.map((sys, i) => {
              const variants = getSystemVariants(sys.id)
              const selected = current === sys.id || variants.some((v) => v.id === current)
              const isPicking = picked === sys.id
              const status = STATUS_LABELS[sys.status]
              return (
                <button
                  key={sys.id}
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`syscard${selected ? ' syscard--selected' : ''}${isPicking ? ' syscard--picking' : ''}${sys.status === 'coming-soon' ? ' syscard--soon' : ''}`}
                  style={{ ['--accent-c' as string]: sys.accent ?? '212, 175, 55', animationDelay: `${90 + i * 70}ms` }}
                  onClick={() => choose(sys)}
                >
                  <span className="syscard__art" style={sys.art ? { backgroundImage: `url(${sys.art})` } : undefined} aria-hidden="true">
                    {!sys.art && <span className="syscard__art-icon">{sys.icon}</span>}
                  </span>
                  <span className="syscard__shade" aria-hidden="true" />
                  <span className="syscard__badges">
                    {status && <span className={`syscard__badge syscard__badge--${sys.status}`}>{status}</span>}
                    {guarded.includes(sys.id) && <span className="syscard__badge syscard__badge--guard">Guardado</span>}
                    {variants.length > 0 && <span className="syscard__badge">2 versões</span>}
                  </span>
                  <span className="syscard__check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                  </span>
                  <span className="syscard__text">
                    <span className="syscard__name"><span className="syscard__icon" aria-hidden="true">{sys.icon}</span>{sys.label}</span>
                    <span className="syscard__desc">{sys.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
