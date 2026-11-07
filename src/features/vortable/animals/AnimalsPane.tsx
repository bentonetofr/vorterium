import { useEffect, useState } from 'react'
import type { Appearance, WatchControls } from '../../../vendor/vortable/vortable'
import type { VortableNet } from '../net/VortableNet'
import { CharacterFace } from '../components/CharacterFace'
import { mapPoint, useMapDrop } from '../enemies/useMapDrop'
import { ask } from '../../../shared/components/dialogs'
import { animalAppearance, isAnimalNpc, placeAnimals, removeAnimals, SPECIES, speciesById, type Coat, type Species } from './animals'
import '../enemies/enemies.css'

type Npc = ReturnType<WatchControls['npcs']>[number]
type Peer = ReturnType<WatchControls['peers']>[number]
type Tab = 'colocar' | 'zona'

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

const DRAG_TYPE = 'application/x-vortable-animal'
const SPREADS = [{ label: 'Colados', tiles: 1.5 }, { label: 'Perto', tiles: 4 }, { label: 'Espalhados', tiles: 9 }]

const appearanceCache = new Map<string, Promise<Appearance>>()
function appearanceOf(species: Species, coat: Coat): Promise<Appearance> {
  const key = `${species.id}:${coat.id}`
  let p = appearanceCache.get(key)
  if (!p) { p = animalAppearance(species, coat); appearanceCache.set(key, p) }
  return p
}

function Portrait({ species, coat, size = 56 }: { species: Species; coat: Coat; size?: number }) {
  const [a, setA] = useState<Appearance | null>(null)
  useEffect(() => { let dead = false; void appearanceOf(species, coat).then((x) => { if (!dead) setA(x) }).catch(() => {}); return () => { dead = true } }, [species, coat])
  return a ? <CharacterFace appearance={a} size={size} /> : <span className="enemy__ph" style={{ width: size, height: size }} />
}

/**
 * Painel "Animais" do controle ao vivo: o mestre põe cavalos, cachorros e lobos gigantes na cena (clicando em Colocar ou arrastando pro mapa),
 * vê os que já estão na zona e pode controlar um deles como se fosse um jogador.
 */
export function AnimalsPane({ viewEl, watch, campaignId, worldId, worldName, zoneId, net, peers, npcs, controlling, onControl }: Props) {
  const [tab, setTab] = useState<Tab>('colocar')
  const [speciesId, setSpeciesId] = useState<Species['id']>('cavalo')
  const [count, setCount] = useState(1)
  const [spread, setSpread] = useState(1)
  const [anchor, setAnchor] = useState('spawn')
  const [showName, setShowName] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const species = SPECIES.find((s) => s.id === speciesId) ?? SPECIES[0]
  const here = peers.filter((p) => p.zone === zoneId)
  const anchorPeer = anchor === 'spawn' ? null : here.find((p) => p.id === anchor) ?? null
  const mine = npcs.filter((n) => isAnimalNpc(n.id))
  const ctx = { campaignId, worldId, worldName, zoneId: zoneId ?? '', net }

  async function place(sp: Species, coat: Coat, at: { x: number; y: number } | null, exact: boolean) {
    if (!zoneId) return
    setBusy(coat.id); setNote(null)
    try {
      await placeAnimals({ ...ctx, species: sp, coat, count, anchor: at, spread: SPREADS[spread].tiles, exact, showName })
      setNote(`${count > 1 ? `${count} ` : ''}${sp.label.toLowerCase()}${count > 1 ? 's' : ''} (${coat.label.toLowerCase()}) na cena.`)
    } catch (err) { setNote(err instanceof Error ? err.message : 'Não deu pra colocar.') } finally { setBusy(null) }
  }

  // arrastar um animal do painel e soltar no mapa: ele aparece exatamente onde o mouse soltou
  useMapDrop(viewEl, DRAG_TYPE, (data, pageX, pageY) => {
    const [sid, cid] = data.split(':')
    const sp = speciesById(sid)
    const coat = sp?.coats.find((c) => c.id === cid)
    if (!sp || !coat) return
    const point = mapPoint(watch, pageX, pageY)
    if (!point) { setNote('Pra arrastar, o motor do Vortable precisa da remenda da câmera (node scripts/patch-vortable-camera.mjs). Use o botão Colocar.'); return }
    void place(sp, coat, point, true)
  })

  function startDrag(e: React.DragEvent, sp: Species, coat: Coat) {
    e.dataTransfer.setData(DRAG_TYPE, `${sp.id}:${coat.id}`)
    e.dataTransfer.setData('text/plain', `${sp.label} ${coat.label}`)
    e.dataTransfer.effectAllowed = 'copy'
    const face = (e.currentTarget as HTMLElement).querySelector('canvas')
    if (face) e.dataTransfer.setDragImage(face, face.clientWidth / 2, face.clientHeight - 4)
  }

  async function remove(ids?: string[]) {
    if (!zoneId) return
    setBusy('rm'); setNote(null)
    try {
      const n = await removeAnimals({ ...ctx, ids })
      setNote(n > 1 ? `${n} animais saíram da cena.` : n === 1 ? '1 animal saiu da cena.' : 'Nada para tirar.')
    } catch (err) { setNote(err instanceof Error ? err.message : 'Não deu pra tirar.') } finally { setBusy(null) }
  }

  return (
    <section className="live__block enemy">
      <h4>Animais</h4>
      <div className="live__segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'colocar'} className={`live__seg${tab === 'colocar' ? ' live__seg--on' : ''}`} onClick={() => setTab('colocar')}>Colocar</button>
        <button type="button" role="tab" aria-selected={tab === 'zona'} className={`live__seg${tab === 'zona' ? ' live__seg--on' : ''}`} onClick={() => setTab('zona')}>Na zona{mine.length > 0 ? ` (${mine.length})` : ''}</button>
      </div>

      {tab === 'colocar' && (
        <>
          <div className="live__chips" aria-label="Bicho">
            {SPECIES.map((s) => (
              <button key={s.id} type="button" className={`live__chip${speciesId === s.id ? ' live__chip--on' : ''}`} onClick={() => setSpeciesId(s.id)}>{s.label}</button>
            ))}
          </div>
          <div className="enemy__opts">
            <div className="live__field">
              <label htmlFor="animal-anchor">Onde</label>
              <select id="animal-anchor" className="live__select" value={anchorPeer ? anchor : 'spawn'} onChange={(e) => setAnchor(e.target.value)}>
                <option value="spawn">No ponto de partida da zona</option>
                {here.map((p) => <option key={p.id} value={p.id}>Perto de {p.name}</option>)}
              </select>
            </div>
            <div className="live__field">
              <label htmlFor="animal-count">Quantos</label>
              <select id="animal-count" className="live__select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
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
          <p className="live__empty">Arraste o animal para o mapa, ou use o botão Colocar.</p>
          <ul className="enemy__list">
            {species.coats.map((c) => (
              <li key={c.id} className="enemy__card enemy__card--drag enemy__card--lib" draggable onDragStart={(e) => startDrag(e, species, c)} title="Arraste para o mapa e solte onde quiser">
                <div className="enemy__lead"><Portrait species={species} coat={c} /></div>
                <div className="enemy__info">
                  <strong>{species.label} {c.label.toLowerCase()}</strong>
                  <span>{c.blurb}</span>
                </div>
                <div className="enemy__actions">
                  <button type="button" className="btn btn-primary" disabled={!zoneId || busy != null} onClick={() => void place(species, c, anchorPeer ? { x: anchorPeer.x, y: anchorPeer.y } : null, false)}>
                    {busy === c.id ? '…' : `Colocar${count > 1 ? ` ${count}` : ''}`}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {note && <p className="live__empty" role="status">{note}</p>}
        </>
      )}

      {tab === 'zona' && (
        <>
          {mine.length === 0 && <p className="live__empty">Nenhum animal nesta zona.</p>}
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
            <button type="button" className="btn btn-ghost" disabled={busy != null} onClick={() => ask({ title: 'Tirar os animais', message: 'Tirar todos os animais desta zona?', tone: 'danger', confirmLabel: 'Tirar todos' }, () => void remove())}>Tirar todos desta zona</button>
          )}
          {note && <p className="live__empty" role="status">{note}</p>}
        </>
      )}
    </section>
  )
}
