import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useDiceRoller } from '../DiceRollerProvider'
import { DiceRollerPanel } from './DiceRollerPanel'
import { Presence } from '../../../shared/components/Presence'
import { useFloatingPanel } from '../../../shared/lib/floatingPanels'
import { useFabToastSlot } from '../../../shared/components/FabToasts'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { loadTdaFonts } from '../../sheets/terraDevastadaAdaptada/utils/tdaFonts'
import type { DiceRoll, RollBreakdownItem } from '../../../shared/types'
import './DiceFab.css'

// Duração do "quique" antes de assentar no resultado final.
const ROLL_ANIMATION_MS = 600
// Quanto tempo a notificação de resultado fica visível antes de sumir sozinha.
const TOAST_DURATION_MS = 4000
// Máximo de dados desenhados quicando — decorativo, não é 1:1 com fórmulas grandes.
const MAX_BOUNCING_DICE = 6

const ROLL_SOUND_URL = '/dice-roll.mp3'

function playRollSound() {
  try {
    const audio = new Audio(ROLL_SOUND_URL)
    audio.volume = 0.6
    void audio.play().catch(() => {
      // autoplay bloqueado pelo navegador ou outro erro — nunca deve
      // impedir a rolagem em si, o som é só um extra
    })
  } catch {
    // ambiente sem suporte à Audio API — ignora
  }
}

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function signStr(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

// Lados de cada dado que aparece quicando na notificação — um item por dado
// individual da rolagem (ex: "2d20+1d4" vira [20, 20, 4]), limitado para caber no palco.
function collectDiceSides(roll: DiceRoll): number[] {
  const breakdown = roll.roll_breakdown
  if (!breakdown) return [20]
  const sides: number[] = []
  for (const b of breakdown) {
    if (b.type === 'modifier') continue
    for (let i = 0; i < b.quantity; i++) sides.push(b.sides)
  }
  return sides.length > 0 ? sides.slice(0, MAX_BOUNCING_DICE) : [20]
}

// d6 usa as faces de dado reais do Unicode (⚀-⚅); os outros tipos não têm face
// própria no Unicode, então desenham o contorno minimalista do sólido.
function DieShapeIcon({ sides }: { sides: number }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
  switch (sides) {
    case 4:  return <svg {...common}><polygon points="12,3 21,19 3,19" /></svg>
    case 8:  return <svg {...common}><polygon points="12,3 21,12 12,21 3,12" /></svg>
    case 10: return <svg {...common}><polygon points="12,2 20,9 17,20 7,20 4,9" /></svg>
    case 12: return <svg {...common}><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" /></svg>
    default: return (
      // d20 e demais (d100...): hexágono facetado — "arredondado" de longe, mas
      // um dado nunca é redondo de verdade, então marca as facetas com raios internos.
      <svg {...common}>
        <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" />
        <path d="M12,2 L12,12 M20,7 L12,12 M20,17 L12,12 M12,22 L12,12 M4,17 L12,12 M4,7 L12,12" />
      </svg>
    )
  }
}

function totalClass(roll: DiceRoll): string {
  const breakdown = roll.roll_breakdown
  if (!breakdown) return 'dice-toast__total'
  // crit: apenas 1 termo de dado com qty=1, sem modifier, resultado = sides
  const diceTerms = breakdown.filter((b) => b.type !== 'modifier')
  // Teste de pares: nenhum par é a falha; Golpe de Sorte (algum 6) brilha.
  const evens = diceTerms.find((b) => b.type === 'evens')
  if (evens && evens.type === 'evens') {
    if (roll.result === 0) return 'dice-toast__total dice-toast__total--min'
    if (evens.bonus.length > 0) return 'dice-toast__total dice-toast__total--max'
    return 'dice-toast__total'
  }
  if (diceTerms.length === 1) {
    const t = diceTerms[0]
    if ('sides' in t) {
      const noMod = !breakdown.some((b) => b.type === 'modifier')
      if (t.quantity === 1 && t.results[0] === t.sides && noMod) {
        return 'dice-toast__total dice-toast__total--max'
      }
      if (t.quantity === 1 && t.results[0] === 1 && noMod) {
        return 'dice-toast__total dice-toast__total--min'
      }
    }
  }
  return 'dice-toast__total'
}

function ToastBreakdown({ breakdown }: { breakdown: RollBreakdownItem[] }) {
  const diceTerms = breakdown.filter((b) => b.type !== 'modifier')
  const modTerm   = breakdown.find(
    (b): b is Extract<RollBreakdownItem, { type: 'modifier' }> => b.type === 'modifier'
  )
  const isEvens = diceTerms.some((b) => b.type === 'evens')

  return (
    <dl className="dice-breakdown">
      {diceTerms.map((item, idx) => {
        if (item.type === 'sum') {
          return (
            <div key={idx} className="dice-breakdown__row">
              <dt className="dice-breakdown__label">{item.notation}</dt>
              <dd className="dice-breakdown__value">
                {item.results.join(', ')}
                {item.quantity > 1 && (
                  <span className="dice-breakdown__sub"> = {item.subtotal}</span>
                )}
              </dd>
            </div>
          )
        }
        if (item.type === 'evens') {
          return (
            <div key={idx} className="dice-breakdown__row">
              <dt className="dice-breakdown__label">{item.notation}</dt>
              <dd className="dice-breakdown__value">
                {item.results.join(', ')}
                {item.bonus.length > 0 && <> · 6 de novo: {item.bonus.join(', ')}</>}
                <span className="dice-breakdown__sub"> → {item.subtotal} {item.subtotal === 1 ? 'par' : 'pares'}</span>
              </dd>
            </div>
          )
        }
        if (item.type === 'keep_highest' || item.type === 'keep_lowest') {
          const label = item.type === 'keep_highest' ? 'maior' : 'menor'
          return (
            <div key={idx} className="dice-breakdown__row">
              <dt className="dice-breakdown__label">{item.notation}</dt>
              <dd className="dice-breakdown__value">
                {item.results.join(', ')}
                <span className="dice-breakdown__sub"> → {label}: {item.kept}</span>
              </dd>
            </div>
          )
        }
        return null
      })}
      {modTerm && (
        <div className="dice-breakdown__row">
          <dt className="dice-breakdown__label">{isEvens ? 'Convicção' : 'Modificador'}</dt>
          <dd className="dice-breakdown__value">{signStr(modTerm.value)}</dd>
        </div>
      )}
    </dl>
  )
}

/** Com uma janela do canto aberta, o aviso vai pro topo dela; senão fica aqui. */
function portalTo(slot: HTMLElement | null, node: ReactNode) {
  return slot ? createPortal(node, slot) : node
}

export function DiceFab() {
  const { user } = useAuth()
  const { campaignId, isOpen, open, close } = useDiceRoller()
  // Terra Devastada Adaptada: o resultado aparece no visual de The Last of Us.
  const { campaign } = useCurrentCampaign()
  const adapted = campaign?.id === campaignId && campaign?.system === 'terra_devastada_adaptada'
  useEffect(() => { if (adapted) loadTdaFonts() }, [adapted])

  // ── Notificação de resultado ──
  const [activeRoll, setActiveRoll]     = useState<DiceRoll | null>(null)
  const [displayRoll, setDisplayRoll]   = useState<number | null>(null)
  const [bouncingSides, setBouncingSides] = useState<number[]>([])
  const [toastKey, setToastKey]         = useState(0)
  const cycleRef   = useRef<number | null>(null)
  const dismissRef = useRef<number | null>(null)

  // ── Giro do ícone ao clicar ──
  const [spinKey, setSpinKey] = useState(0)

  const { instant } = useFloatingPanel('dice', isOpen, close)
  // Com uma janela do canto aberta, o resultado aparece no topo dela.
  const toastSlot = useFabToastSlot()

  function handleToggle() {
    setSpinKey((k) => k + 1)
    if (isOpen) close(); else open()
  }

  useEffect(() => () => {
    if (cycleRef.current !== null)   window.clearInterval(cycleRef.current)
    if (dismissRef.current !== null) window.clearTimeout(dismissRef.current)
  }, [])

  function handleRoll(roll: DiceRoll) {
    if (cycleRef.current !== null)   window.clearInterval(cycleRef.current)
    if (dismissRef.current !== null) window.clearTimeout(dismissRef.current)

    playRollSound()
    setBouncingSides(collectDiceSides(roll))
    cycleRef.current = window.setInterval(() => {
      setDisplayRoll(1 + Math.floor(Math.random() * 20))
    }, 60)

    window.setTimeout(() => {
      if (cycleRef.current !== null) window.clearInterval(cycleRef.current)
      cycleRef.current = null
      setDisplayRoll(null)
      setBouncingSides([])
      setActiveRoll(roll)
      setToastKey((k) => k + 1)

      dismissRef.current = window.setTimeout(() => {
        setActiveRoll(null)
        dismissRef.current = null
      }, TOAST_DURATION_MS)
    }, ROLL_ANIMATION_MS)
  }

  if (!user) return null

  if (!campaignId) {
    return (
      <button
        type="button"
        className="dice-fab dice-fab--locked"
        disabled
        aria-label="Rolagem de dados indisponível fora de uma campanha"
        title="Entre em uma campanha para rolar dados"
      >
        <svg
          width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </button>
    )
  }

  return (
    <>
      {(activeRoll || displayRoll !== null) && portalTo(toastSlot,
        <div key={toastKey} className={`dice-toast${adapted ? ' dice-toast--tda' : ''}`} role="status" aria-live="polite">
          <div className="dice-toast__header">
            <span className="dice-toast__label">
              {adapted ? (activeRoll?.roll_mode === 'evens' ? 'Teste' : 'Rolagem') : 'Última rolagem'}
              {displayRoll === null && activeRoll?.is_private && (
                <span title="Rolagem privada" aria-label="Rolagem privada"> 🔒</span>
              )}
            </span>
            {displayRoll === null && activeRoll && (
              <span className="dice-toast__formula">{activeRoll.formula ?? activeRoll.die_type}</span>
            )}
          </div>

          <div className="dice-toast__total-row">
            <span className={displayRoll !== null ? 'dice-toast__total dice-toast__total--spinning' : totalClass(activeRoll!)}>
              {displayRoll !== null ? displayRoll : activeRoll!.result}
            </span>
          </div>
          {adapted && displayRoll === null && activeRoll?.roll_mode === 'evens' && (
            <p className="dice-toast__unit">{activeRoll.result === 1 ? 'ponto de desempenho' : 'pontos de desempenho'}</p>
          )}

          {displayRoll !== null && bouncingSides.length > 0 && (
            <div className="dice-toast__bounce-row" aria-hidden="true">
              {bouncingSides.map((sides, i) => (
                <span
                  key={i}
                  className="dice-toast__bounce-die"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  {sides === 6
                    ? DIE_FACES[(displayRoll + i * 13) % DIE_FACES.length]
                    : <DieShapeIcon sides={sides} />}
                </span>
              ))}
            </div>
          )}

          {displayRoll === null && activeRoll?.roll_breakdown && activeRoll.roll_breakdown.length > 0 && (
            <ToastBreakdown breakdown={activeRoll.roll_breakdown} />
          )}
        </div>,
      )}

      {(isOpen || !instant) && (
      <Presence show={isOpen} exitMs={180}>
        {(state) => (
        <div className="dice-fab__popover fab-panel anim-pop" data-state={state} data-fab-panel="dice" role="dialog" aria-label="Rolagem de dados">
          <div className="dice-fab__popover-header">
            <span className="dice-fab__popover-icon" aria-hidden="true">⚄</span>
            <span className="dice-fab__popover-title">Rolagem de dados</span>
            <button
              type="button"
              className="dice-fab__popover-close"
              onClick={close}
              aria-label="Fechar rolagem de dados"
            >
              ✕
            </button>
          </div>
          <DiceRollerPanel campaignId={campaignId} currentUserId={user.id} onRoll={handleRoll} />
        </div>
        )}
      </Presence>
      )}

      <button
        type="button"
        className={`dice-fab${isOpen ? ' dice-fab--open' : ''}`}
        onClick={handleToggle}
        aria-label={isOpen ? 'Fechar rolagem de dados' : 'Abrir rolagem de dados'}
        aria-expanded={isOpen}
      >
        <span key={spinKey} className="dice-fab__icon" aria-hidden="true">⚄</span>
      </button>
    </>
  )
}
