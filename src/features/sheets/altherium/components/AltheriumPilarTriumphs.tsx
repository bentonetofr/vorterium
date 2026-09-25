import { useRef, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Presence } from '../../../../shared/components/Presence'
import { rollDice } from '../../../dice/services/diceService'
import { PILAR_TRIUMPHS, TRIUMPH_ACTION_LABELS, type PilarTriumphDef } from '../constants/altheriumTriumphs'
import {
  DECK_SIZE,
  SUITS,
  cardLabel,
  cardValue,
  drawOne,
  parseCard,
  suitInfo,
  type Suit,
} from '../utils/pilarCards'

// ────────────────────────────────────────────────────────
// Triunfos do Pilar (livro, p. 31–35). O número de cada triunfo é quantas
// combinações de naipe ele exige — não quantas cartas custa. Ao usar, o
// jogador escolhe um naipe e vira cartas até juntar as combinações; cada
// carta virada gasta 1 das cartas do Pilar.
//
// Dois jeitos de jogar (fica salvo na ficha):
//   · Baralho virtual — a ficha vira as cartas na tela e desconta sozinha.
//   · Cartas físicas  — o jogador usa um baralho de verdade, escolhe o
//     naipe e informa quantas cartas gastou.
// ────────────────────────────────────────────────────────

export type PilarCardMode = 'virtual' | 'fisico'

export interface PilarUseResult {
  triumph: PilarTriumphDef
  suit:    Suit
  spent:   number
  success: boolean
  instant: boolean
  /** Parou de puxar antes de fechar a combinação. */
  gaveUp:  boolean
}

interface AltheriumPilarTriumphsProps {
  campaignId:   string
  cardsCurrent: number
  cardsMax:     number | null
  mode:         PilarCardMode
  deck:         string[] | null
  disabled?:    boolean
  onModeChange: (mode: PilarCardMode) => void
  onDeckReset:  () => void
  /** Gasta cartas (e, no virtual, guarda o baralho depois da carta puxada). */
  onSpend:      (cards: number, deck?: string[]) => void
  /** Fim da jogada — anuncia pra mesa. */
  onResolve:    (result: PilarUseResult) => void
  /** "Retorno do Baralho": soma as cartas recuperadas (a ficha limita ao máximo). */
  onRecover:    (cards: number) => void
}

const RECOVER_TRIUMPH_ID = 'retorno-do-baralho'

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function AltheriumPilarTriumphs({
  campaignId, cardsCurrent, cardsMax, mode, deck, disabled = false,
  onModeChange, onDeckReset, onSpend, onResolve, onRecover,
}: AltheriumPilarTriumphsProps) {
  const [using, setUsing] = useState<PilarTriumphDef | null>(null)
  const [lastUsed, setLastUsed] = useState<string | null>(null)
  const deckLeft = deck?.length ?? DECK_SIZE

  function handleResolve(result: PilarUseResult) {
    onResolve(result)
    const what = `${result.triumph.name}: ${plural(result.spent, 'carta gasta', 'cartas gastas')}`
    setLastUsed(result.success ? `${what}, combinação feita.` : result.gaveUp ? `${what}, desistiu.` : `${what}, não conseguiu a combinação.`)
  }

  return (
    <section className="alth-card alth-triumphs">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Triunfos do Pilar</h4>
        <div className="alth-pilar-mode" role="group" aria-label="Como você joga as cartas">
          {(['virtual', 'fisico'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`alth-pilar-mode__btn${mode === m ? ' alth-pilar-mode__btn--active' : ''}`}
              aria-pressed={mode === m}
              onClick={() => onModeChange(m)}
              disabled={disabled}
            >
              {m === 'virtual' ? 'Baralho virtual' : 'Cartas físicas'}
            </button>
          ))}
        </div>
      </div>

      <ul className="alth-triumphs__rules">
        <li>
          O número de cada triunfo é quantas <strong>combinações de naipe</strong> ele precisa. Escolha um naipe e
          puxe cartas uma a uma até juntar essa quantidade. <strong>Toda carta puxada gasta 1 carta.</strong>
        </li>
        <li><strong>Carta do naipe:</strong> 1 combinação. <strong>Ás do naipe:</strong> 2.</li>
        <li><strong>Coringa:</strong> vale como qualquer carta. <strong>Ás de espadas:</strong> sucesso instantâneo.</li>
        <li>Dá pra desistir a qualquer momento; se desistir ou as cartas acabarem, o triunfo falha e as cartas puxadas se perdem.</li>
      </ul>

      {mode === 'virtual' && (
        <p className="alth-pilar-deck">
          <span className="alth-pilar-deck__stack" aria-hidden="true" />
          {plural(deckLeft, 'carta', 'cartas')} no baralho até reembaralhar
          <button type="button" className="alth-pilar-deck__shuffle" onClick={onDeckReset} disabled={disabled || deckLeft === DECK_SIZE}>
            Embaralhar tudo
          </button>
        </p>
      )}

      {cardsCurrent === 0 && (
        <p className="alth-triumphs__warn" role="status">Sem cartas: elas só voltam depois de um descanso.</p>
      )}
      {lastUsed && <p key={lastUsed} className="alth-triumphs__used" role="status">{lastUsed}</p>}

      <div className="alth-triumphs__grid">
        {PILAR_TRIUMPHS.map((t) => (
          <article key={t.id} className="alth-triumph">
            <header className="alth-triumph__head">
              <h5 className="alth-triumph__name">{t.name}</h5>
              <span className="alth-triumph__cost alth-triumph__cost--cards" title="Combinações de naipe necessárias">
                {plural(t.cost, 'combinação', 'combinações')}
              </span>
            </header>
            <p className="alth-triumph__desc">{t.description}</p>
            <div className="alth-triumph__chips">
              <span className="alth-triumph__chip">{TRIUMPH_ACTION_LABELS.bonus}</span>
            </div>
            <div className="alth-triumph__actions">
              <button
                type="button" className="alth-triumph__btn alth-triumph__btn--use"
                disabled={disabled || cardsCurrent === 0}
                title={cardsCurrent === 0 ? 'Sem cartas até o descanso' : undefined}
                onClick={() => setUsing(t)}
              >
                Usar
              </button>
            </div>
          </article>
        ))}
      </div>

      <Presence show={using !== null} exitMs={220}>
        {() => using && (
          <PilarUseModal
            campaignId={campaignId}
            triumph={using}
            mode={mode}
            deck={deck}
            cardsCurrent={cardsCurrent}
            cardsMax={cardsMax}
            onSpend={onSpend}
            onResolve={handleResolve}
            onRecover={onRecover}
            onClose={() => setUsing(null)}
          />
        )}
      </Presence>
    </section>
  )
}

// ── Janela de uso ────────────────────────────────────────

type Outcome = 'success' | 'fail' | 'gaveup'

interface PilarUseModalProps {
  campaignId:   string
  triumph:      PilarTriumphDef
  mode:         PilarCardMode
  deck:         string[] | null
  cardsCurrent: number
  cardsMax:     number | null
  onSpend:      (cards: number, deck?: string[]) => void
  onResolve:    (result: PilarUseResult) => void
  onRecover:    (cards: number) => void
  onClose:      () => void
}

function PilarUseModal({
  campaignId, triumph, mode, deck, cardsCurrent, cardsMax, onSpend, onResolve, onRecover, onClose,
}: PilarUseModalProps) {
  // Cartas na hora de abrir — a ficha desconta a cada carta puxada.
  const [startCards] = useState(cardsCurrent)
  const [suit, setSuit] = useState<Suit | null>(null)
  // Virtual: cartas puxadas até agora (uma por clique).
  const [drawn, setDrawn] = useState<string[]>([])
  const [combos, setCombos] = useState(0)
  const [instant, setInstant] = useState(false)
  const [reshuffled, setReshuffled] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Baralho "vivo" durante a jogada — o da ficha só chega depois do render.
  const deckRef = useRef<string[] | null>(deck)
  // Físico: quantas cartas o jogador virou na mesa.
  const [spentText, setSpentText] = useState('')
  // Retorno do Baralho
  const [recovering, setRecovering] = useState(false)
  const [recovered, setRecovered] = useState<number | null>(null)
  const [recoverError, setRecoverError] = useState<string | null>(null)

  const spentNumber = Number(spentText)
  const spentValid = Number.isInteger(spentNumber) && spentNumber >= 1 && spentNumber <= startCards
  const spent = mode === 'virtual' ? drawn.length : outcome ? spentNumber : 0
  const cardsLeft = startCards - spent
  const playing = mode === 'virtual' && suit != null && drawn.length > 0 && outcome == null

  function finish(result: Outcome, spentCards: number, wasInstant = false) {
    if (!suit) return
    setOutcome(result)
    onResolve({
      triumph, suit, spent: spentCards,
      success: result === 'success', instant: wasInstant, gaveUp: result === 'gaveup',
    })
  }

  /** Virtual: puxa uma carta, gasta 1 e vê se fechou a combinação. */
  function drawCard() {
    if (!suit || outcome || drawn.length >= startCards) return
    const pulled = drawOne(deckRef.current)
    deckRef.current = pulled.deck
    if (pulled.reshuffled) setReshuffled(true)
    const nextDrawn = [...drawn, pulled.card]
    setDrawn(nextDrawn)
    onSpend(1, pulled.deck)

    const value = cardValue(pulled.card, suit)
    if (value.instant) {
      setInstant(true)
      finish('success', nextDrawn.length, true)
      return
    }
    const nextCombos = combos + value.combos
    setCombos(nextCombos)
    if (nextCombos >= triumph.cost) finish('success', nextDrawn.length)
    else if (nextDrawn.length >= startCards) finish('fail', nextDrawn.length)
  }

  function giveUp() {
    if (!playing) return
    finish('gaveup', drawn.length)
  }

  function confirmPhysical(success: boolean) {
    if (!suit || !spentValid) return
    onSpend(spentNumber)
    finish(success ? 'success' : 'fail', spentNumber)
  }

  // No meio da jogada, só "Desistir" encerra — clique fora ou Esc não.
  const lockClose = recovering || playing

  async function recover() {
    setRecovering(true)
    setRecoverError(null)
    try {
      const roll = await rollDice(campaignId, '1d20+3')
      setRecovered(roll.result)
      onRecover(roll.result)
    } catch (err) {
      setRecoverError(err instanceof Error ? err.message : 'Não foi possível rolar.')
    } finally {
      setRecovering(false)
    }
  }

  const resultTitle =
    outcome === 'success' ? (instant ? 'Ás de espadas! Sucesso instantâneo.' : 'Combinação feita, o triunfo acontece.')
      : outcome === 'fail' ? 'As cartas acabaram. O triunfo falhou.'
      : 'Você desistiu. O triunfo não acontece.'

  return (
    <ModalOverlay onClose={onClose} closeDisabled={lockClose}>
      <div className="alth-modal__window alth-pilar-use" role="dialog" aria-modal="true" aria-labelledby="alth-pilar-use-title">
        <header className="alth-modal__header">
          <h4 id="alth-pilar-use-title" className="alth-modal__title">{triumph.name}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={lockClose} aria-label="Fechar">×</button>
        </header>

        <div className="alth-pilar-use__body">
          <p className="alth-pilar-use__need">
            Precisa de <strong>{plural(triumph.cost, 'combinação', 'combinações')}</strong> de naipe.
            Você tem <strong>{plural(cardsLeft, 'carta', 'cartas')}</strong>
            {cardsMax != null && <> de {cardsMax}</>}.
          </p>

          {/* 1. Naipe (trava depois da primeira carta) */}
          {drawn.length === 0 && outcome == null && (
            <>
              <span className="label">Escolha o naipe</span>
              <div className="alth-pilar-suits" role="radiogroup" aria-label="Naipe">
                {SUITS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={suit === s.id}
                    className={`alth-pilar-suit${s.red ? ' alth-pilar-suit--red' : ''}${suit === s.id ? ' alth-pilar-suit--active' : ''}`}
                    onClick={() => setSuit(s.id)}
                  >
                    <span className="alth-pilar-suit__symbol" aria-hidden="true">{s.symbol}</span>
                    <span className="alth-pilar-suit__label">{s.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 2a. Virtual: puxar uma a uma */}
          {mode === 'virtual' && suit && drawn.length > 0 && (
            <>
              <div className="alth-pilar-progress" aria-live="polite">
                <span>Naipe: <strong className={suitInfo(suit).red ? 'alth-pilar-red' : undefined}>{suitInfo(suit).symbol} {suitInfo(suit).label}</strong></span>
                <span>Combinações: <strong>{Math.min(combos, triumph.cost)}/{triumph.cost}</strong></span>
                <span>Cartas gastas: <strong>{drawn.length}</strong></span>
              </div>
              <ol className="alth-pilar-table" aria-label="Cartas puxadas">
                {drawn.map((code, i) => (
                  <PlayingCard key={`${i}-${code}`} code={code} suit={suit} />
                ))}
              </ol>
              {reshuffled && <p className="alth-hint">O baralho acabou e foi reembaralhado.</p>}
            </>
          )}

          {mode === 'virtual' && outcome == null && (
            <div className="alth-triumph__actions">
              {playing ? (
                <button type="button" className="alth-triumph__btn" onClick={giveUp}>
                  Desistir
                </button>
              ) : (
                <button type="button" className="alth-triumph__btn" onClick={onClose}>Cancelar</button>
              )}
              <button type="button" className="alth-triumph__btn alth-triumph__btn--use alth-pilar-draw" onClick={drawCard} disabled={!suit}>
                {drawn.length === 0 ? 'Puxar a primeira carta' : 'Puxar outra carta'}
              </button>
            </div>
          )}
          {playing && (
            <p className="alth-hint">
              Cada carta puxada gasta 1. Se desistir agora, as {plural(drawn.length, 'carta puxada se perde', 'cartas puxadas se perdem')}.
            </p>
          )}

          {/* 2b. Físico: informar */}
          {mode === 'fisico' && outcome == null && (
            <>
              <label className="alth-pilar-spent">
                <span className="label">Quantas cartas você virou?</span>
                <input
                  type="number" className="input" inputMode="numeric" min={1} max={startCards}
                  value={spentText} onChange={(e) => setSpentText(e.target.value)}
                />
              </label>
              {spentText !== '' && !spentValid && (
                <p className="alth-triumphs__warn" role="alert">Informe de 1 a {startCards} cartas.</p>
              )}
              <div className="alth-triumph__actions">
                <button type="button" className="alth-triumph__btn" onClick={() => confirmPhysical(false)} disabled={!suit || !spentValid}>
                  Não consegui
                </button>
                <button type="button" className="alth-triumph__btn alth-triumph__btn--use" onClick={() => confirmPhysical(true)} disabled={!suit || !spentValid}>
                  Consegui a combinação
                </button>
              </div>
            </>
          )}

          {/* 3. Resultado */}
          {outcome && (
            <div className={`alth-pilar-result${outcome === 'success' ? ' alth-pilar-result--ok' : ' alth-pilar-result--fail'}`} role="status">
              <strong>{resultTitle}</strong>
              <span>{plural(spent, 'carta gasta', 'cartas gastas')} · restam {plural(cardsLeft, 'carta', 'cartas')}</span>
            </div>
          )}

          {outcome === 'success' && triumph.id === RECOVER_TRIUMPH_ID && (
            <div className="alth-pilar-recover">
              {recovered == null ? (
                <button type="button" className="alth-triumph__btn alth-triumph__btn--use" onClick={() => void recover()} disabled={recovering}>
                  {recovering ? 'Rolando…' : 'Rolar 1d20+3 e recuperar cartas'}
                </button>
              ) : (
                <p className="alth-pilar-recover__done">Recuperou <strong>{plural(recovered, 'carta', 'cartas')}</strong> (até o máximo do nível).</p>
              )}
              {recoverError && <p className="alth-triumphs__warn" role="alert">{recoverError}</p>}
            </div>
          )}

          {outcome && (
            <div className="alth-triumph__actions">
              <button type="button" className="alth-triumph__btn alth-triumph__btn--use" onClick={onClose} disabled={recovering}>
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Carta ────────────────────────────────────────────────

function PlayingCard({ code, suit }: { code: string; suit: Suit }) {
  const card = parseCard(code)
  const value = cardValue(code, suit)
  const tone = value.instant ? 'instant' : value.combos > 0 ? 'hit' : 'miss'
  const red = card.suit === 'H' || card.suit === 'D'
  return (
    <li className={`alth-pcard alth-pcard--${tone}${red ? ' alth-pcard--red' : ''}${card.joker ? ' alth-pcard--joker' : ''}`} title={cardLabel(code)}>
      {card.joker ? (
        <>
          <span className="alth-pcard__corner">★</span>
          <span className="alth-pcard__center">Coringa</span>
        </>
      ) : (
        <>
          <span className="alth-pcard__corner">{card.rank}<br />{suitInfo(card.suit!).symbol}</span>
          <span className="alth-pcard__center">{suitInfo(card.suit!).symbol}</span>
        </>
      )}
      {value.combos > 0 && <span className="alth-pcard__badge">+{value.combos}</span>}
      <span className="sr-only">{cardLabel(code)}</span>
    </li>
  )
}
