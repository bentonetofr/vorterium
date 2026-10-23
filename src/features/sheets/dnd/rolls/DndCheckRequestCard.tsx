import { useCallback, useEffect, useMemo, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Presence } from '../../../../shared/components/Presence'
import { Select } from '../../../../shared/components/Select'
import type { DiceRoll } from '../../../../shared/types'
import { subscribeToRolls } from '../../../dice/services/diceService'
import {
  closeCheckRequest, createCheckRequest, listOpenCheckRequests, listRequestAnswers, revealCheckDc, subscribeToCheckRequests,
  type DndAdvantage, type DndCheckRequest,
} from '../services/dndCheckService'
import { CHECK_CHOICES } from './checkRequests'
import { judge } from './checkModel'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// Mestre: um botão "Pedir teste" no topo da lista de fichas. Ele abre uma
// janelinha para pedir um teste a um ou mais jogadores (perícia, salvaguarda,
// atributo, iniciativa, morte ou um teste livre), com CD aberta ou oculta e
// vantagem. Na mesma janela ficam os pedidos abertos com a resposta de cada
// jogador ao vivo (o d20, o total e se passou) e o botão de encerrar. Os
// pedidos abertos são carregados mesmo com a janela fechada, para o botão
// mostrar quantos há.
// ────────────────────────────────────────────────────────

export interface RequestPlayer { userId: string; name: string }

const CUSTOM = 'custom'
const OPTIONS = [...CHECK_CHOICES.map((c) => ({ value: c.value, label: `${c.group} · ${c.label}` })), { value: CUSTOM, label: 'Outro (escrever)' }]
const ADV: { value: DndAdvantage; label: string }[] = [{ value: 'disadvantage', label: 'Desvantagem' }, { value: 'normal', label: 'Normal' }, { value: 'advantage', label: 'Vantagem' }]

interface DialogProps {
  campaignId: string
  players:    RequestPlayer[]
  open:       DndCheckRequest[]
  answers:    DiceRoll[]
  hiddenDc:   Record<string, number | null>
  /** Recarrega os pedidos (depois de pedir ou encerrar). */
  refresh:    () => Promise<void>
  onClose:    () => void
}

/** A janelinha de pedir teste (e dos pedidos abertos). */
export function DndCheckRequestDialog({ campaignId, players, open, answers, hiddenDc, refresh, onClose }: DialogProps) {
  const [targets, setTargets] = useState<Set<string>>(() => new Set(players.map((p) => p.userId)))
  const [choice, setChoice] = useState('skill:perception')
  const [custom, setCustom] = useState('')
  const [dc, setDc] = useState('15')
  const [hidden, setHidden] = useState(false)
  const [reveal, setReveal] = useState(true)
  const [advantage, setAdvantage] = useState<DndAdvantage>('normal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const picked = CHECK_CHOICES.find((c) => c.value === choice)
  const label = choice === CUSTOM ? custom.trim() : picked?.label ?? ''
  const dcNum = dc.trim() === '' ? null : Math.max(1, Math.min(40, Number.parseInt(dc, 10) || 0)) || null
  const canSend = !busy && targets.size > 0 && label.length > 0

  async function send() {
    if (!canSend) return
    setBusy(true)
    setError(null)
    try {
      await createCheckRequest({
        campaignId, targets: [...targets], kind: choice === CUSTOM ? 'custom' : picked!.kind, key: choice === CUSTOM ? null : picked!.key,
        label, dc: picked?.kind === 'death' ? 10 : dcNum, dcHidden: hidden && dcNum != null, dcReveal: reveal, advantage,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível pedir o teste.')
    } finally { setBusy(false) }
  }

  async function close(id: string) {
    try { await closeCheckRequest(id); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível encerrar.') }
  }

  const byId = useMemo(() => new Map(players.map((p) => [p.userId, p.name])), [players])

  return (
    <ModalOverlay onClose={onClose}>
      <section className="dsh-sheet dcq dcq-dialog" role="dialog" aria-modal="true" aria-labelledby="dcq-title">
        <header className="dcq__head">
          <h4 id="dcq-title" className="dcq__title">Pedir teste</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <span className="dcq__hint">O painel abre na tela dos jogadores escolhidos.</span>

        <div className="dcq__row" role="group" aria-label="Jogadores">
          {players.length === 0 && <span className="dsh-faint">Nenhum jogador com ficha ainda.</span>}
          {players.map((p) => {
            const on = targets.has(p.userId)
            return (
              <button key={p.userId} type="button" className={`dsh-bookchip${on ? ' is-on' : ''}`} aria-pressed={on}
                onClick={() => setTargets((t) => { const n = new Set(t); if (on) n.delete(p.userId); else n.add(p.userId); return n })}>{p.name}</button>
            )
          })}
          {players.length > 1 && <button type="button" className="dsh-link" onClick={() => setTargets(new Set(players.map((p) => p.userId)))}>todos</button>}
        </div>

        <div className="dcq__grid">
          <div className="dsh-field dsh-field--tile dcq__test"><span className="dsh-label">Teste</span>
            <Select options={OPTIONS} value={choice} onChange={setChoice} aria-label="Teste" listClassName="dsh-sheet" /></div>
          {choice === CUSTOM && (
            <label className="dsh-field dsh-field--tile dcq__test"><span className="dsh-label">Nome do teste</span>
              <input className="dsh-focus__input" value={custom} maxLength={80} placeholder="Ex.: Segurar a porta" onChange={(e) => setCustom(e.target.value)} /></label>
          )}
          {picked?.kind !== 'death' && (
            <label className="dsh-field dsh-field--tile dcq__dc"><span className="dsh-label">CD</span>
              <input className="dsh-focus__input" inputMode="numeric" value={dc} placeholder="sem CD" onChange={(e) => setDc(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
          )}
        </div>

        <div className="dcq__row">
          {picked?.kind !== 'death' && (
            <button type="button" className={`dsh-flag dsh-flag--sm${hidden ? ' is-on' : ''}`} aria-pressed={hidden} disabled={dcNum == null}
              onClick={() => setHidden((h) => !h)} title="O jogador vê “CD ?” antes de rolar">CD oculta</button>
          )}
          {picked?.kind !== 'death' && hidden && dcNum != null && (
            <button type="button" className={`dsh-flag dsh-flag--sm${reveal ? ' is-on' : ''}`} aria-pressed={reveal} onClick={() => setReveal((r) => !r)}
              title={reveal ? 'Depois de rolar, o jogador descobre a CD e vê se passou. Clique para manter a CD só com você.' : 'A CD fica só com você: o jogador não descobre nem depois de rolar. Clique para revelar depois da rolagem.'}>
              {reveal ? 'Revela depois de rolar' : 'Não revela a CD'}
            </button>
          )}
          <div className="dsh-seg" role="group" aria-label="Vantagem">
            {ADV.map((a) => <button key={a.value} type="button" className={`dsh-seg__btn${advantage === a.value ? ' is-on' : ''}`} aria-pressed={advantage === a.value} onClick={() => setAdvantage(a.value)}>{a.label}</button>)}
          </div>
        </div>

        <button type="button" className="dsh-newattack__add" disabled={!canSend} onClick={() => void send()}>{busy ? 'Enviando...' : `Pedir ${label || 'teste'}`}</button>
        {error && <p className="dsh-warn">{error}</p>}

        {open.length > 0 && (
          <ul className="dcq__list" aria-label="Pedidos abertos">
            {open.map((r) => {
              const dcShown = r.dc_hidden ? hiddenDc[r.id] ?? null : r.dc
              return (
                <li key={r.id} className="dcq__req">
                  <div className="dcq__req-head">
                    <strong>{r.label}</strong>
                    <span className="dsh-cardchip">{r.dc_hidden ? `CD oculta${dcShown != null ? ` (${dcShown})` : ''}` : r.dc != null ? `CD ${r.dc}` : 'sem CD'}</span>
                    {r.advantage !== 'normal' && <span className="dsh-cardchip">{r.advantage === 'advantage' ? 'vantagem' : 'desvantagem'}</span>}
                    <button type="button" className="dsh-link" onClick={() => void close(r.id)}>Encerrar</button>
                  </div>
                  <ul className="dcq__answers">
                    {r.targets.map((t) => {
                      const a = [...answers].reverse().find((x) => x.user_id === t && x.roll_context?.request_id === r.id)
                      const nat = a?.roll_context?.natural
                      const verdict = a && nat != null ? judge(r.kind === 'custom' ? 'ability' : r.kind, nat, a.result, dcShown) : null
                      return (
                        <li key={t} className={`dcq__answer${verdict?.outcome ? ` is-${verdict.outcome}` : ''}`}>
                          <span>{a?.roll_context?.character ?? byId.get(t) ?? 'Jogador'}</span>
                          {a ? (
                            <span className="dcq__answer-total">
                              {nat != null && <small>d20 {nat}{verdict?.crit === 'crit' ? ' ★' : ''} · </small>}
                              <strong>{a.result}</strong>
                              {verdict?.outcome && <em>{verdict.outcome === 'success' ? 'passou' : 'falhou'}</em>}
                            </span>
                          ) : <span className="dsh-faint">aguardando…</span>}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </ModalOverlay>
  )
}

/** O botão "Pedir teste" do mestre (e a janelinha que ele abre). */
export function DndCheckRequestCard({ campaignId, players }: { campaignId: string; players: RequestPlayer[] }) {
  const [shown, setShown] = useState(false)
  const [open, setOpen] = useState<DndCheckRequest[]>([])
  const [answers, setAnswers] = useState<DiceRoll[]>([])
  const [hiddenDc, setHiddenDc] = useState<Record<string, number | null>>({})

  const refresh = useCallback(async () => {
    const list = await listOpenCheckRequests(campaignId)
    setOpen(list)
    setAnswers(await listRequestAnswers(campaignId, list.map((r) => r.id)))
    for (const r of list.filter((x) => x.dc_hidden)) {
      void revealCheckDc(r.id).then((v) => setHiddenDc((m) => ({ ...m, [r.id]: v })))
    }
  }, [campaignId])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => subscribeToCheckRequests(campaignId, () => { void refresh() }), [campaignId, refresh])
  useEffect(() => subscribeToRolls(campaignId, (row) => {
    if (!row.roll_context?.request_id) return
    setAnswers((a) => (a.some((x) => x.id === row.id) ? a : [...a, row]))
  }), [campaignId])

  return (
    <div className="dsh-sheet dcq-bar">
      <button type="button" className="dsh-chip dsh-chip--primary dcq-bar__btn" onClick={() => setShown(true)} aria-haspopup="dialog">Pedir teste</button>
      {open.length > 0 && (
        <button type="button" className="dsh-link dcq-bar__open" onClick={() => setShown(true)}>
          {open.length === 1 ? '1 pedido aberto' : `${open.length} pedidos abertos`}
        </button>
      )}
      <Presence show={shown}>
        {() => <DndCheckRequestDialog campaignId={campaignId} players={players} open={open} answers={answers} hiddenDc={hiddenDc} refresh={refresh} onClose={() => setShown(false)} />}
      </Presence>
    </div>
  )
}
