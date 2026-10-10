import { useEffect, useRef, useState } from 'react'
import type { WatchControls } from '../../../vendor/vortable/vortable'
import type { VortableNet } from '../net/VortableNet'
import { CharacterFace } from '../components/CharacterFace'
import { mapPoint, useMapDrop } from '../enemies/useMapDrop'
import { ARCHETYPES, placePeople, removePeople, rollPeople, type ArchetypeId, type ArmsMode, type Person } from './people'
import '../enemies/enemies.css'

type Npc = ReturnType<WatchControls['npcs']>[number]
type Peer = ReturnType<WatchControls['peers']>[number]
type Tab = 'gerar' | 'zona'

const DRAG_TYPE = 'application/x-vortable-person'
const ARMS: { id: ArmsMode; label: string; title: string }[] = [
  { id: 'auto', label: 'Conforme o tipo', title: 'Soldado quase sempre armado, médico quase nunca' },
  { id: 'always', label: 'Sempre armado', title: 'Todos saem com pelo menos uma arma na mão' },
  { id: 'none', label: 'Desarmado', title: 'Ninguém leva arma' },
]
const SPREADS = [{ label: 'Colados', tiles: 1.5 }, { label: 'Perto', tiles: 4 }, { label: 'Espalhados', tiles: 9 }]

interface Props {
  viewEl: HTMLElement | null
  watch: WatchControls | null
  campaignId: string
  worldId: string
  worldName: string
  zoneId: string | null
  net: VortableNet | null
  peers: Peer[]
  npcs: Npc[]
  controlling: string | null
  onControl: (id: string) => void
}

/**
 * Gerador de NPCs do controle ao vivo: sorteia pessoas (sobreviventes, soldados, Vagalumes, saqueadores...) com roupa,
 * chapéu e armas, e o mestre arrasta a que quiser pro mapa (ou clica em Colocar).
 */
export function PeoplePane({ viewEl, watch, campaignId, worldId, worldName, zoneId, net, peers, npcs, controlling, onControl }: Props) {
  const [tab, setTab] = useState<Tab>('gerar')
  const [arch, setArch] = useState<ArchetypeId | null>(null)
  const [arms, setArms] = useState<ArmsMode>('auto')
  const [spread, setSpread] = useState(1)
  const [anchor, setAnchor] = useState('spawn')
  const [showName, setShowName] = useState(false)
  const [cards, setCards] = useState<Person[]>([])
  const [rolling, setRolling] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  async function roll() {
    setRolling(true); setNote(null)
    try {
      const people = await rollPeople(arch, 6, arms)
      if (alive.current) setCards(people)
    } catch (err) { setNote(err instanceof Error ? err.message : 'Não deu pra sortear.') } finally { if (alive.current) setRolling(false) }
  }
  useEffect(() => { void roll() }, [arch, arms]) // eslint-disable-line react-hooks/exhaustive-deps

  const here = peers.filter((p) => p.zone === zoneId)
  const anchorPeer = anchor === 'spawn' ? null : here.find((p) => p.id === anchor) ?? null
  const ctx = { campaignId, worldId, worldName, zoneId: zoneId ?? '', net }
  const mine = npcs.filter((n) => n.id.startsWith('pess-'))

  async function place(people: Person[], at: { x: number; y: number } | null, exact: boolean) {
    if (!zoneId || people.length === 0) return
    setBusy('place'); setNote(null)
    try {
      await placePeople({ ...ctx, people, anchor: at, spread: SPREADS[spread].tiles, exact, showName })
      setNote(people.length === 1 ? `${people[0].name} entrou na cena.` : `${people.length} pessoas entraram na cena.`)
    } catch (err) { setNote(err instanceof Error ? err.message : 'Não deu pra colocar.') } finally { setBusy(null) }
  }

  const here0 = anchorPeer ? { x: anchorPeer.x, y: anchorPeer.y } : null

  useMapDrop(viewEl, DRAG_TYPE, (key, pageX, pageY) => {
    const person = cards.find((c) => c.key === key)
    if (!person) return
    const point = mapPoint(watch, pageX, pageY)
    if (!point) { setNote('Pra arrastar, o motor do Vortable precisa da remenda da câmera (node scripts/patch-vortable-camera.mjs). Use o botão Colocar.'); return }
    void place([person], point, true)
  })

  function startDrag(e: React.DragEvent, p: Person) {
    e.dataTransfer.setData(DRAG_TYPE, p.key)
    e.dataTransfer.setData('text/plain', p.name)
    e.dataTransfer.effectAllowed = 'copy'
    const face = (e.currentTarget as HTMLElement).querySelector('canvas')
    if (face) e.dataTransfer.setDragImage(face, face.clientWidth / 2, face.clientHeight - 4)
  }

  async function remove(ids?: string[]) {
    if (!zoneId) return
    setBusy('rm'); setNote(null)
    try {
      const n = await removePeople({ ...ctx, ids })
      setNote(n ? `${n} pessoa${n > 1 ? 's' : ''} saiu da cena.` : 'Nada para tirar.')
    } catch (err) { setNote(err instanceof Error ? err.message : 'Não deu pra tirar.') } finally { setBusy(null) }
  }

  const label = (id: string) => ARCHETYPES.find((a) => a.id === id)?.label ?? id

  return (
    <section className="live__block enemy">
      <h4>Gerador de NPCs</h4>
      <div className="live__segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'gerar'} className={`live__seg${tab === 'gerar' ? ' live__seg--on' : ''}`} onClick={() => setTab('gerar')}>Gerar</button>
        <button type="button" role="tab" aria-selected={tab === 'zona'} className={`live__seg${tab === 'zona' ? ' live__seg--on' : ''}`} onClick={() => setTab('zona')}>Na zona{mine.length > 0 ? ` (${mine.length})` : ''}</button>
      </div>

      {tab === 'gerar' && (
        <>
          <div className="live__chips" aria-label="Tipo de pessoa">
            <button type="button" className={`live__chip${arch == null ? ' live__chip--on' : ''}`} onClick={() => setArch(null)} title="Mistura de tipos">Qualquer</button>
            {ARCHETYPES.map((a) => (
              <button key={a.id} type="button" title={a.blurb} className={`live__chip${arch === a.id ? ' live__chip--on' : ''}`} onClick={() => setArch(a.id)}>{a.label}</button>
            ))}
          </div>
          <div className="live__chips" aria-label="Armamento">
            {ARMS.map((a) => (
              <button key={a.id} type="button" title={a.title} className={`live__chip${arms === a.id ? ' live__chip--on' : ''}`} onClick={() => setArms(a.id)}>{a.label}</button>
            ))}
          </div>
          <div className="enemy__opts">
            <div className="live__field">
              <label htmlFor="people-anchor">Onde</label>
              <select id="people-anchor" className="live__select" value={anchorPeer ? anchor : 'spawn'} onChange={(e) => setAnchor(e.target.value)}>
                <option value="spawn">No ponto de partida da zona</option>
                {here.map((p) => <option key={p.id} value={p.id}>Perto de {p.name}</option>)}
              </select>
            </div>
            <div className="live__chips">
              {SPREADS.map((s, i) => (
                <button key={s.label} type="button" className={`live__chip${spread === i ? ' live__chip--on' : ''}`} onClick={() => setSpread(i)}>{s.label}</button>
              ))}
            </div>
            <label className="live__switchrow">
              <input type="checkbox" className="live__switch" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
              Mostrar o nome sobre a cabeça
            </label>
          </div>
          <div className="live__row">
            <button type="button" className="btn btn-ghost" disabled={rolling} onClick={() => void roll()}>{rolling ? 'Sorteando…' : 'Sortear de novo'}</button>
            <button type="button" className="btn btn-primary" disabled={!zoneId || busy != null || cards.length === 0} onClick={() => void place(cards, here0, false)} title="Coloca todos os sorteados juntos">Colocar todos ({cards.length})</button>
          </div>
          <p className="live__empty">Arraste a pessoa para o mapa, ou use o botão Colocar dela.</p>
          <ul className="enemy__list">
            {cards.map((p) => (
              <li key={p.key} className="enemy__card enemy__card--drag" draggable onDragStart={(e) => startDrag(e, p)} title="Arraste para o mapa e solte onde quiser">
                <CharacterFace appearance={p.appearance} size={56} />
                <div className="enemy__info">
                  <strong>{p.name}</strong>
                  <small>{label(p.archetype)}</small>
                  <span>{p.role} · {p.gear}</span>
                </div>
                <button type="button" className="btn btn-primary" disabled={!zoneId || busy != null} onClick={() => void place([p], here0, false)}>Colocar</button>
              </li>
            ))}
          </ul>
          {note && <p className="live__empty" role="status">{note}</p>}
        </>
      )}

      {tab === 'zona' && (
        <>
          {mine.length === 0 && <p className="live__empty">Nenhuma pessoa gerada nesta zona.</p>}
          <ul className="enemy__list">
            {mine.map((n) => (
              <li key={n.id} className="enemy__card enemy__card--row">
                <div className="enemy__info">
                  <strong>{n.name}</strong>
                  <small>{controlling === n.id ? 'controlando' : n.role}</small>
                </div>
                <div className="enemy__actions">
                  <button type="button" className={`live__chip${controlling === n.id ? ' live__chip--on' : ''}`} onClick={() => onControl(n.id)} title="Controlar como um jogador (setas ou WASD)">Controlar</button>
                  <button type="button" className="live__chip" disabled={busy != null} onClick={() => void remove([n.id])}>Tirar</button>
                </div>
              </li>
            ))}
          </ul>
          {mine.length > 1 && (
            <button type="button" className="btn btn-ghost" disabled={busy != null} onClick={() => { if (confirm('Tirar todas as pessoas geradas desta zona?')) void remove() }}>Tirar todas desta zona</button>
          )}
          {note && <p className="live__empty" role="status">{note}</p>}
        </>
      )}
    </section>
  )
}
