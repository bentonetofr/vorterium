import { useMemo, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { DOMAINS, CARD_TYPE_LABEL, DOMAIN_ORDER } from '../catalog/rules'
import { DOMAIN_CARDS, cardImage, domainCard } from '../catalog/domainCards'
import { cardsInHand, markStress, maxCardLevel, ownedDomains } from '../model/derive'
import { LOADOUT_MAX } from '../model/defaults'
import type { DhDomain, DhDomainCard, DhSheetData } from '../model/types'
import { DomainIcon } from './DomainIcon'
import { RuleText, DhSelect } from './DhUi'

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
                  <DhSelect label="Trocar com" value="" onChange={(v) => { if (v) toHand(c.id, v) }}
                    options={[{ value: '', label: `Trocar com…${resting ? '' : ` (${c.recall} Fadiga)`}` }, ...hand.filter((h) => h.id !== 'notorious').map((h) => ({ value: h.id, label: h.name }))]} />
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
  const dom = DOMAINS[card.domain]
  return (
    <article className={`dh-card dh-card--img${used ? ' is-used' : ''}${compact ? ' is-compact' : ''}`} style={{ '--dh-domain': dom.color } as React.CSSProperties}>
      <img className="dh-card__img" src={cardImage(card.id)} width={360} height={504} loading="lazy" draggable={false}
        alt={`${card.name}: ${CARD_TYPE_LABEL[card.type]} de ${dom.name}, nível ${card.level}, custo de troca ${card.recall}`} />
      <details className="dh-card__more">
        <summary>Texto da carta</summary>
        <div className="dh-card__text"><RuleText text={card.text} /></div>
      </details>
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
  const [last, setLast] = useState<string | null>(null)

  function pick(c: DhDomainCard) {
    const to = cardsInHand(data) < LOADOUT_MAX ? 'para a mão' : 'para a reserva (a mão está cheia)'
    onPick(c.id)
    setLast(`${c.name} foi ${to}.`)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="dh-dialog dh-browser dh-browser--modal" role="dialog" aria-modal="true" aria-label="Pegar carta de domínio">
        <header className="dh-dialog__head">
          <div>
            <small className="dh-lvl__kicker">Cartas dos seus domínios</small>
            <h3>Pegar carta</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="dh-picker__bar">
          <span className="dh-seg" role="group">
            <button type="button" className={dom === 'todos' ? 'is-on' : ''} onClick={() => setDom('todos')}>Todos</button>
            {domains.map((d) => <button key={d} type="button" className={dom === d ? 'is-on' : ''} onClick={() => setDom(d)}><DomainIcon domain={d} size={14} title={false} /> {DOMAINS[d].name}</button>)}
          </span>
          <input type="search" className="dh-browser__search" placeholder="Buscar pelo nome" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar carta" />
          <label className="dh-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Ver acima do meu nível</label>
        </div>
        {last && <p className="dh-notice dh-browser__notice" role="status" onClick={() => setLast(null)}>{last}</p>}
        <div className="dh-browser__body">
          <div className="dh-cardgrid">
            {list.map((c) => <CardView key={c.id} card={c} compact actions={<button type="button" className="btn btn-primary" onClick={() => pick(c)}>Pegar</button>} />)}
            {list.length === 0 && <p className="dh-empty">Nenhuma carta disponível com esses filtros.</p>}
          </div>
        </div>
        <footer className="dh-dialog__foot">
          <span className="dh-browser__count">{list.length} {list.length === 1 ? 'carta disponível' : 'cartas disponíveis'}</span>
          <button type="button" className="btn" onClick={onClose}>Concluir</button>
        </footer>
      </div>
    </ModalOverlay>
  )
}
