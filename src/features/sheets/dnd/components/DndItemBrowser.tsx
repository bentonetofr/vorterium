import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import {
  ITEM_KINDS, ITEM_KIND_LABEL, groupsOf, searchItems, weaponDamageTypes, weaponProperties,
  type BookItem, type ItemKind, type ItemSort,
} from '../catalog/itemBook'
import { formatKg } from '../model/format'

// ────────────────────────────────────────────────────────
// Livro de itens: janela no centro do site com todos os itens do catálogo em
// cards, barra de busca e filtros (tipo, categoria, alcance, dano, propriedade,
// "que sei usar" e ordem). Clicar no card leva o item para a ficha na hora (se
// já tem, soma 1 na quantidade); "Ver mais" mostra tudo sobre o item.
// ────────────────────────────────────────────────────────

const PAGE = 48
const KIND_TAG: Record<ItemKind, string> = { weapon: 'Arma', armor: 'Armadura', gear: 'Equip.', tool: 'Ferram.' }
const RANGE_CHIPS = [{ value: 'melee', label: 'Corpo a corpo' }, { value: 'ranged', label: 'À distância' }] as const
const SORT_CHIPS: { value: ItemSort; label: string }[] = [{ value: 'name', label: 'Nome' }, { value: 'weight', label: 'Mais leve' }, { value: 'cost', label: 'Mais barato' }]
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

interface Props {
  /** Quantas unidades de cada item (pela chave do catálogo) a ficha já tem. */
  owned:     ReadonlyMap<string, number>
  /** O que o personagem sabe usar, para o filtro "Que sei usar". */
  prof:      { weapons: readonly string[]; armor: readonly string[] }
  readOnly:  boolean
  busy:      string | null
  onAdd:     (item: BookItem) => void
  onClose?:  () => void
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`dsh-bookchip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>{children}</button>
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="dsh-book__row" role="group" aria-label={label}>
      {label && <span className="dsh-book__rowlabel">{label}</span>}
      {children}
    </div>
  )
}

export function DndItemBrowser({ owned, prof, readOnly, busy, onAdd, onClose }: Props) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ItemKind | ''>('')
  const [group, setGroup] = useState('')
  const [range, setRange] = useState<'melee' | 'ranged' | ''>('')
  const [damage, setDamage] = useState('')
  const [property, setProperty] = useState('')
  const [usable, setUsable] = useState(false)
  const [sort, setSort] = useState<ItemSort>('name')
  const [shown, setShown] = useState(PAGE)
  const [detail, setDetail] = useState<BookItem | null>(null)

  const groups = useMemo(() => (kind ? groupsOf(kind) : []), [kind])
  const properties = useMemo(weaponProperties, [])
  const damageTypes = useMemo(weaponDamageTypes, [])
  const weaponsOnly = kind === 'weapon'

  const searchText = useDeferredValue(text)
  const results = useMemo(() => searchItems({
    text: searchText, kind: kind || undefined, group: group || undefined, range: weaponsOnly && range ? range : undefined,
    damageType: weaponsOnly && damage ? damage : undefined, property: weaponsOnly && property ? property : undefined,
    usable: usable ? prof : undefined, sort,
  }), [searchText, kind, group, range, damage, property, usable, prof, sort, weaponsOnly])

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE) }
  const pickKind = (k: ItemKind | '') => { setKind(k); setGroup(''); setRange(''); setDamage(''); setProperty(''); setShown(PAGE) }
  const close = onClose ?? (() => {})
  const toggle = <T extends string>(current: T | '', value: T, set: (v: T | '') => void) => reset(set)(current === value ? '' : value)

  const stateOf = (i: BookItem) => {
    const n = owned.get(i.key) ?? 0
    if (busy === i.key) return 'Adicionando...'
    return n > 0 ? `✓ Tem ×${n} · + mais um` : '+ Adicionar'
  }

  return (
    <ModalOverlay onClose={close}>
      <div className="dsh-sheet dsh-book" role="dialog" aria-modal="true" aria-labelledby="dsh-itembook-title">
        <header className="dsh-book__head">
          <div className="dsh-book__titles">
            <h3 id="dsh-itembook-title" className="dsh-book__title">Livro de itens</h3>
            <span className="dsh-book__count">{results.length} {results.length === 1 ? 'item' : 'itens'}</span>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Fechar">×</button>
        </header>

        <div className="dsh-book__filters">
          <input type="search" className="dsh-book__search" value={text} placeholder="Buscar item pelo nome (ex.: espada longa)" aria-label="Buscar item" autoFocus
            onChange={(e) => reset(setText)(e.target.value)} />
          <Row label="Tipo">
            <Chip on={kind === ''} onClick={() => pickKind('')}>Todos</Chip>
            {ITEM_KINDS.map((k) => <Chip key={k} on={kind === k} onClick={() => pickKind(k)}>{ITEM_KIND_LABEL[k]}</Chip>)}
            <span className="dsh-book__spacer" aria-hidden="true" />
            <Chip on={usable} onClick={() => reset(setUsable)(!usable)}>Só o que sei usar</Chip>
          </Row>
          {groups.length > 0 && (
            <Row label="Categoria">
              {groups.map((g) => <Chip key={g} on={group === g} onClick={() => toggle(group, g, setGroup)}>{g}</Chip>)}
            </Row>
          )}
          {weaponsOnly && (
            <>
              <Row label="Alcance">
                {RANGE_CHIPS.map((r) => <Chip key={r.value} on={range === r.value} onClick={() => toggle(range, r.value, setRange)}>{r.label}</Chip>)}
              </Row>
              <Row label="Dano">
                {damageTypes.map((d) => <Chip key={d} on={damage === d} onClick={() => toggle(damage, d, setDamage)}>{capitalize(d)}</Chip>)}
              </Row>
              <Row label="Propriedade">
                {properties.map((p) => <Chip key={p} on={property === p} onClick={() => toggle(property, p, setProperty)}>{capitalize(p)}</Chip>)}
              </Row>
            </>
          )}
          <Row label="Ordem">
            {SORT_CHIPS.map((s) => <Chip key={s.value} on={sort === s.value} onClick={() => reset(setSort)(s.value)}>{s.label}</Chip>)}
          </Row>
        </div>

        <div className="dsh-book__body">
          {results.length === 0 && <p className="dsh-faint dsh-book__empty">Nenhum item com esses filtros.</p>}
          <ul className="dsh-bookgrid">
            {results.slice(0, shown).map((i) => {
              const n = owned.get(i.key) ?? 0
              return (
                <li key={i.key} className={`dsh-bookcard${n > 0 ? ' is-owned' : ''}`}>
                  <button type="button" className="dsh-bookcard__body" disabled={readOnly || busy === i.key} onClick={() => onAdd(i)}
                    title={n > 0 ? 'Já está na ficha: clique para somar mais um' : 'Clique para adicionar à ficha'}>
                    <span className="dsh-bookcard__top">
                      <span className="dsh-tag">{KIND_TAG[i.kind]}</span>
                      <span className="dsh-badge">{i.group}</span>
                    </span>
                    <strong className="dsh-bookcard__name">{i.name}</strong>
                    <span className="dsh-bookcard__meta">{i.cost} · {formatKg(i.weight)}</span>
                    <span className="dsh-spellchips">
                      {i.tags.filter((t) => t !== i.group).slice(0, 3).map((t) => <span key={t} className="dsh-cardchip">{t}</span>)}
                    </span>
                    <span className="dsh-bookcard__state">{stateOf(i)}</span>
                  </button>
                  <button type="button" className="dsh-bookcard__more" onClick={() => setDetail(i)}>Ver mais</button>
                </li>
              )
            })}
          </ul>
          {results.length > shown && (
            <button type="button" className="dsh-chip dsh-book__more" onClick={() => setShown((n) => n + PAGE)}>Mostrar mais {Math.min(PAGE, results.length - shown)}</button>
          )}
        </div>

        {detail && (
          <div className="dsh-book__detail" role="region" aria-label={`Detalhes de ${detail.name}`}>
            <div className="dsh-book__detail-head">
              <button type="button" className="dsh-chip" onClick={() => setDetail(null)}>← Voltar</button>
              {!readOnly && (
                <button type="button" className="dsh-chip dsh-chip--primary" disabled={busy === detail.key} onClick={() => onAdd(detail)}>
                  {(owned.get(detail.key) ?? 0) > 0 ? `Somar mais um (tem ×${owned.get(detail.key)})` : 'Adicionar à ficha'}
                </button>
              )}
            </div>
            <h4 className="dsh-book__detail-title">{detail.name} <span className="dsh-faint">{ITEM_KIND_LABEL[detail.kind]} · {detail.group}</span></h4>
            <dl className="dsh-facts dsh-facts--tight">
              {detail.facts.map((f) => <div key={f.label} className="dsh-facts__pair"><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
              <div className="dsh-facts__pair"><dt>Custo</dt><dd>{detail.cost}</dd></div>
              <div className="dsh-facts__pair"><dt>Peso</dt><dd>{formatKg(detail.weight)}</dd></div>
            </dl>
            {detail.weapon && detail.weapon.properties.length > 0 && (
              <div className="dsh-spellchips">{detail.weapon.properties.map((p) => <span key={p} className="dsh-cardchip">{p}</span>)}</div>
            )}
            {detail.description && <p className="dsh-note">{detail.description}</p>}
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
