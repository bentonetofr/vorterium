import { useMemo, useState } from 'react'
import { DOMAINS, CARD_TYPE_LABEL, DOMAIN_ORDER } from '../catalog/rules'
import { DOMAIN_CARDS, domainCard } from '../catalog/domainCards'
import { cardsInHand, markStress, maxCardLevel, ownedDomains } from '../model/derive'
import { LOADOUT_MAX } from '../model/defaults'
import type { DhDomain, DhDomainCard, DhSheetData } from '../model/types'
import { RuleText } from './DhUi'

// ────────────────────────────────────────────────────────
// Cartas de domínio: a mão (até 5 ativas; a carta Notoriedade não conta) e a reserva. Trocar fora do descanso custa Fadiga
// igual ao custo de troca da carta que entra; num descanso a troca é de graça.
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  canEdit: boolean
}

export function DhCardsTab({ data, update, canEdit }: Props) {
  const [resting, setResting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const inHand = cardsInHand(data)
  const hand = data.loadout.map(domainCard).filter((c): c is DhDomainCard => !!c)
  const vault = data.vault.map(domainCard).filter((c): c is DhDomainCard => !!c)

  function toVault(id: string) {
    update((d) => ({ ...d, loadout: d.loadout.filter((x) => x !== id), vault: [...d.vault, id] }))
  }

  function toHand(id: string, swapOut?: string) {
    const card = domainCard(id)
    if (!card) return
    const cost = resting ? 0 : card.recall
    update((d) => {
      const marks = cost > 0 ? markStressMany(d, cost) : { stressMarked: d.stressMarked, hpMarked: d.hpMarked }
      const loadout = d.loadout.filter((x) => x !== swapOut)
      const vault = d.vault.filter((x) => x !== id)
      if (swapOut) vault.push(swapOut)
      return { ...d, ...marks, loadout: [...loadout, id], vault }
    })
    if (cost > 0) setNote(`Troca fora do descanso: ${cost} Ponto${cost === 1 ? '' : 's'} de Fadiga marcado${cost === 1 ? '' : 's'}.`)
    else setNote(null)
  }

  function toggleUsed(id: string) {
    update((d) => ({ ...d, cardsUsed: d.cardsUsed.includes(id) ? d.cardsUsed.filter((x) => x !== id) : [...d.cardsUsed, id] }))
  }

  function remove(id: string) {
    update((d) => ({ ...d, loadout: d.loadout.filter((x) => x !== id), vault: d.vault.filter((x) => x !== id), cardsUsed: d.cardsUsed.filter((x) => x !== id) }))
  }

  const full = inHand >= LOADOUT_MAX

  return (
    <div className="dh-cards">
      <div className="dh-cards__bar">
        <strong>Mão: {inHand}/{LOADOUT_MAX}</strong>
        {canEdit && <label className="dh-check"><input type="checkbox" checked={resting} onChange={(e) => setResting(e.target.checked)} /> Estou em descanso (trocar sem custo)</label>}
        {canEdit && <button type="button" className="btn" onClick={() => setAdding(true)}>Pegar carta</button>}
      </div>
      {note && <p className="dh-notice" role="status" onClick={() => setNote(null)}>{note}</p>}

      <h3 className="dh-cards__h">Mão (cartas ativas)</h3>
      <div className="dh-cardgrid">
        {hand.map((c) => (
          <CardView key={c.id} card={c} used={data.cardsUsed.includes(c.id)} onUsed={canEdit ? () => toggleUsed(c.id) : undefined}
            actions={canEdit ? <><button type="button" className="dh-link" onClick={() => toVault(c.id)}>Guardar na reserva</button><button type="button" className="dh-link" onClick={() => remove(c.id)}>Descartar</button></> : null} />
        ))}
        {hand.length === 0 && <p className="dh-empty">Nenhuma carta na mão.</p>}
      </div>

      <h3 className="dh-cards__h">Reserva</h3>
      <div className="dh-cardgrid">
        {vault.map((c) => (
          <CardView key={c.id} card={c}
            actions={canEdit ? (
              <>
                {!full ? <button type="button" className="dh-link" onClick={() => toHand(c.id)}>Trazer para a mão{resting ? '' : ` (${c.recall} Fadiga)`}</button> : (
                  <select aria-label="Trocar com" defaultValue="" onChange={(e) => { if (e.target.value) toHand(c.id, e.target.value) }}>
                    <option value="">Trocar com… {resting ? '' : `(${c.recall} Fadiga)`}</option>
                    {hand.filter((h) => h.id !== 'notorious').map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                )}
                <button type="button" className="dh-link" onClick={() => remove(c.id)}>Descartar</button>
              </>
            ) : null} />
        ))}
        {vault.length === 0 && <p className="dh-empty">A reserva está vazia.</p>}
      </div>

      {adding && <CardBrowser data={data} onClose={() => setAdding(false)} onPick={(id) => update((d) => (cardsInHand(d) < LOADOUT_MAX ? { ...d, loadout: [...d.loadout, id] } : { ...d, vault: [...d.vault, id] }))} />}
    </div>
  )
}

function markStressMany(d: DhSheetData, amount: number): { stressMarked: number; hpMarked: number } {
  let cur = { ...d }
  let res = { stressMarked: d.stressMarked, hpMarked: d.hpMarked }
  for (let i = 0; i < amount; i++) {
    res = markStress(cur, 1)
    cur = { ...cur, ...res }
  }
  return res
}

export function CardView({ card, used, onUsed, actions, compact }: { card: DhDomainCard; used?: boolean; onUsed?: () => void; actions?: React.ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  const dom = DOMAINS[card.domain]
  return (
    <article className={`dh-card${used ? ' is-used' : ''}`} style={{ '--dh-domain': dom.color } as React.CSSProperties}>
      <header onClick={() => setOpen(!open)}>
        <span className="dh-card__lvl">{card.level}</span>
        <div>
          <small>{CARD_TYPE_LABEL[card.type]} · {dom.name}</small>
          <h4>{card.name}</h4>
        </div>
        <span className="dh-card__recall" title="Custo de troca">⚡ {card.recall}</span>
      </header>
      {open && <RuleText text={card.text} />}
      <footer>
        {onUsed && <label className="dh-check"><input type="checkbox" checked={!!used} onChange={onUsed} /> Usada</label>}
        {actions}
      </footer>
    </article>
  )
}

function CardBrowser({ data, onClose, onPick }: { data: DhSheetData; onClose: () => void; onPick: (id: string) => void }) {
  const owned = new Set([...data.loadout, ...data.vault])
  const domains = ownedDomains(data)
  const [dom, setDom] = useState<DhDomain | 'todos'>('todos')
  const [all, setAll] = useState(false)
  const [q, setQ] = useState('')
  const list = useMemo(() => DOMAIN_CARDS.filter((c) =>
    domains.includes(c.domain) && !owned.has(c.id) && (dom === 'todos' || c.domain === dom)
    && (all || c.level <= maxCardLevel(data, c.domain)) && (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())),
  ).sort((a, b) => a.level - b.level || DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain)), [domains, owned, dom, all, q, data])
  return (
    <div className="dh-browser">
      <header className="dh-dialog__head">
        <h3>Cartas de domínio</h3>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      <div className="dh-picker__bar">
        <span className="dh-seg" role="group">
          <button type="button" className={dom === 'todos' ? 'is-on' : ''} onClick={() => setDom('todos')}>Todos</button>
          {domains.map((d) => <button key={d} type="button" className={dom === d ? 'is-on' : ''} onClick={() => setDom(d)}>{DOMAINS[d].name}</button>)}
        </span>
        <input type="search" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar carta" />
        <label className="dh-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Ver acima do meu nível</label>
      </div>
      <div className="dh-cardgrid">
        {list.map((c) => <CardView key={c.id} card={c} compact actions={<button type="button" className="btn" onClick={() => onPick(c.id)}>Pegar</button>} />)}
        {list.length === 0 && <p className="dh-empty">Nenhuma carta disponível.</p>}
      </div>
    </div>
  )
}
