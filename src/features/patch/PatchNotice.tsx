import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ModalOverlay } from '../../shared/components/ModalOverlay'
import { Presence } from '../../shared/components/Presence'
import { PATCH_DATE, PATCH_STEPS, PATCH_VERSION, type MascotPose } from './patchNotes'
import './PatchNotice.css'

// ────────────────────────────────────────────────────────
// O aviso de patch: uma janelinha no centro da tela, na primeira vez que cada
// pessoa entra no site depois do patch, com o que mudou em etapas e o mascote
// do Vorterium em algumas delas. Fecha no X, no Esc ou na última etapa, e não
// volta (a conta fica marcada neste aparelho). Quem quiser rever lê as
// Novidades.
// ────────────────────────────────────────────────────────

const seenKey = (userId: string) => `vorterium:patch-visto:${PATCH_VERSION}:${userId}`

function alreadySeen(userId: string): boolean {
  try { return localStorage.getItem(seenKey(userId)) === '1' } catch { return false }
}

function markSeen(userId: string): void {
  try { localStorage.setItem(seenKey(userId), '1') } catch { /* sem armazenamento: só volta a aparecer */ }
}

/** O mascote do Vorterium (o cavaleirinho azul), com uma pose animada e um balãozinho de fala. */
function Mascot({ pose, says }: { pose: MascotPose; says: string }) {
  return (
    <div className={`patch__mascot patch__mascot--${pose}`}>
      <span className="patch__bubble" role="note">{says}</span>
      <div className="patch__mascot-stage" aria-hidden="true">
        {pose === 'celebrate' && <><i className="patch__confetti patch__confetti--a" /><i className="patch__confetti patch__confetti--b" /><i className="patch__confetti patch__confetti--c" /><i className="patch__confetti patch__confetti--d" /></>}
        {pose === 'roll' && <span className="patch__die">⚄</span>}
        {pose === 'read' && <span className="patch__prop">📜</span>}
        {pose === 'wave' && <span className="patch__prop patch__prop--wave">✨</span>}
        <img className="patch__knight" src="/cavaleiro-loading.png" alt="" draggable={false} />
      </div>
    </div>
  )
}

export function PatchCard({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'next' | 'back'>('next')
  const total = PATCH_STEPS.length
  const current = PATCH_STEPS[step]
  const last = step === total - 1

  /** Vai para a etapa `to` (número) ou anda `by` etapas a partir da de agora (certo mesmo com cliques seguidos). */
  const go = useCallback((to: number | { by: number }) => {
    setStep((from) => {
      const next = Math.max(0, Math.min(total - 1, typeof to === 'number' ? to : from + to.by))
      setDir(next >= from ? 'next' : 'back')
      return next
    })
  }, [total])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go({ by: 1 }) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go({ by: -1 }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  return (
    <div className="patch" role="dialog" aria-modal="true" aria-labelledby="patch-title">
      <button type="button" className="patch__close" onClick={onFinish} aria-label="Fechar o aviso">×</button>

      <header className="patch__head">
        <span className="patch__badge">Patch {PATCH_VERSION}</span>
        <span className="patch__date">{PATCH_DATE}</span>
      </header>

      <div className="patch__body" key={current.id} data-dir={dir}>
        <div className="patch__emoji" aria-hidden="true">{current.emoji}</div>
        <h2 id="patch-title" className="patch__title">{current.title}</h2>
        {current.intro && <p className="patch__intro">{current.intro}</p>}
        {current.mascot && <Mascot pose={current.mascot.pose} says={current.mascot.says} />}
        <ul className="patch__lines">
          {current.lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>

      <footer className="patch__foot">
        <div className="patch__dots" role="tablist" aria-label="Etapas do aviso">
          {PATCH_STEPS.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={i === step} aria-label={`Etapa ${i + 1}: ${s.title}`}
              className={`patch__dot${i === step ? ' is-on' : i < step ? ' is-past' : ''}`} onClick={() => go(i)} />
          ))}
        </div>
        <div className="patch__actions">
          {step > 0 ? <button type="button" className="btn btn-ghost patch__btn" onClick={() => go({ by: -1 })}>Voltar</button> : <button type="button" className="btn btn-ghost patch__btn" onClick={onFinish}>Pular</button>}
          <span className="patch__count" aria-live="polite">{step + 1} / {total}</span>
          {last
            ? <button type="button" className="btn btn-primary patch__btn patch__btn--go" onClick={onFinish}>Bora jogar!</button>
            : <button type="button" className="btn btn-primary patch__btn" onClick={() => go({ by: 1 })}>Próximo</button>}
        </div>
      </footer>
    </div>
  )
}

/** Fica montado na área logada; abre sozinho uma vez por conta (neste aparelho). */
export function PatchNotice() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // dá um respiro para a tela carregar antes do aviso aparecer
    if (!userId || alreadySeen(userId)) return
    const t = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(t)
  }, [userId])

  const finish = useCallback(() => {
    if (userId) markSeen(userId)
    setOpen(false)
  }, [userId])

  if (!userId) return null
  return (
    <Presence show={open} exitMs={200}>
      {() => (
        <ModalOverlay onClose={finish}>
          <PatchCard onFinish={finish} />
        </ModalOverlay>
      )}
    </Presence>
  )
}
