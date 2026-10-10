import { useEffect, useRef, useState } from 'react'
import type { Appearance, WatchControls } from '../../../vendor/vortable/vortable'
import type { VortableNet } from '../net/VortableNet'
import './enemies.css'
import { mapPoint, useMapDrop } from './useMapDrop'
import { CharacterFace } from '../components/CharacterFace'
import { CREATURES, creatureAppearance, creatureOfNpc, placeEnemies, removeEnemies, type CreatureDef } from './enemies'
import {
  creatureSfxEnabled, playCreatureSound, setCreatureSfxEnabled, soundDef, SOUND_GROUPS, unlockCreatureAudio,
  type SoundDistance, type SoundGroup,
} from './creatureSounds'

type Npc = ReturnType<WatchControls['npcs']>[number]
type Peer = ReturnType<WatchControls['peers']>[number]
type Tab = 'colocar' | 'zona' | 'sons'

interface Props {
  /** A área do mapa (onde se solta o inimigo arrastado) e os controles da câmera (pra achar o ponto do mapa). */
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

const SPREADS: { label: string; tiles: number; title: string }[] = [
  { label: 'Colados', tiles: 1.5, title: 'Um do lado do outro, quase em cima do ponto' },
  { label: 'Perto', tiles: 4, title: 'Uns quatro passos de distância' },
  { label: 'Espalhados', tiles: 9, title: 'Espalhados pela área, longe uns dos outros' },
]
const DISTANCES: { label: string; value: SoundDistance; title: string }[] = [
  { label: 'Perto', value: 0, title: 'Som limpo e alto' },
  { label: 'Longe', value: 1, title: 'Som abafado, mais baixo' },
  { label: 'Muito longe', value: 2, title: 'Som bem abafado, com eco' },
]
const REPEATS = [{ label: 'Uma vez', every: 0 }, { label: 'A cada 4 s', every: 4 }, { label: 'A cada 8 s', every: 8 }, { label: 'A cada 15 s', every: 15 }]

const DRAG_TYPE = 'application/x-vortable-enemy'
const appearanceCache = new Map<string, Promise<Appearance>>()
function appearanceOf(def: CreatureDef): Promise<Appearance> {
  let p = appearanceCache.get(def.id)
  if (!p) { p = creatureAppearance(def); appearanceCache.set(def.id, p) }
  return p
}

function Portrait({ def, size = 56 }: { def: CreatureDef; size?: number }) {
  const [a, setA] = useState<Appearance | null>(null)
  useEffect(() => { let dead = false; void appearanceOf(def).then((x) => { if (!dead) setA(x) }).catch(() => {}); return () => { dead = true } }, [def])
  return a ? <CharacterFace appearance={a} size={size} /> : <span className="enemy__ph" style={{ width: size, height: size }} />
}

/**
 * Painel "Inimigos" do controle ao vivo: o mestre põe infectados na cena (Corredor, Espreitador, Estalador, Trôpego e Baiacu)
 * e toca os sons deles pra todos na mesa.
 */
export function EnemiesPane({ viewEl, watch, campaignId, worldId, worldName, zoneId, net, peers, npcs, controlling, onControl }: Props) {
  const [tab, setTab] = useState<Tab>('colocar')
  const [count, setCount] = useState(1)
  const [spread, setSpread] = useState(1)
  const [anchor, setAnchor] = useState<string>('spawn')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [volume, setVolume] = useState(() => { try { return Number(localStorage.getItem('vortable:enemy-vol') ?? '0.8') || 0.8 } catch { return 0.8 } })
  const [distance, setDistance] = useState<SoundDistance>(0)
  const [scopeZone, setScopeZone] = useState(true)
  const [repeat, setRepeat] = useState(0)
  const [looping, setLooping] = useState<string | null>(null)
  const [mineOn, setMineOn] = useState(creatureSfxEnabled())
  const [group, setGroup] = useState<SoundGroup['id']>('estalador')
  const loopTimer = useRef<number | undefined>(undefined)

  useEffect(() => { unlockCreatureAudio() }, [])
  useEffect(() => () => window.clearTimeout(loopTimer.current), [])
  useEffect(() => { try { localStorage.setItem('vortable:enemy-vol', String(volume)) } catch { /* sem armazenamento */ } }, [volume])

  // arrastar um inimigo do painel e soltar no mapa: ele aparece exatamente onde o mouse soltou
  useMapDrop(viewEl, DRAG_TYPE, (id, pageX, pageY) => {
    const def = CREATURES.find((c) => c.id === id)
    if (!def || !zoneId) return
    const point = mapPoint(watch, pageX, pageY)
    if (!point) { setNote('Pra arrastar, o motor do Vortable precisa da remenda da câmera (node scripts/patch-vortable-camera.mjs). Use o botão Colocar.'); return }
    setBusy(def.id); setNote(null)
    placeEnemies({ campaignId, worldId, worldName, zoneId, net, creature: def, count, spread: SPREADS[spread].tiles, anchor: point, exact: true })
      .then(() => setNote(`${count > 1 ? `${count} ` : ''}${def.name}${count > 1 ? 's' : ''} no mapa.`))
      .catch((err) => setNote(err instanceof Error ? err.message : 'Não deu pra colocar.'))
      .finally(() => setBusy(null))
  })

  function startDrag(e: React.DragEvent, def: CreatureDef) {
    e.dataTransfer.setData(DRAG_TYPE, def.id)
    e.dataTransfer.setData('text/plain', def.name)
    e.dataTransfer.effectAllowed = 'copy'
    const face = (e.currentTarget as HTMLElement).querySelector('canvas')
    if (face) e.dataTransfer.setDragImage(face, face.clientWidth / 2, face.clientHeight - 4)
  }

  const here = peers.filter((p) => p.zone === zoneId)
  const enemies = npcs.filter((n) => n.id.startsWith('inim-'))
  const anchorPeer = anchor === 'spawn' ? null : here.find((p) => p.id === anchor) ?? null
  const ctx = { campaignId, worldId, worldName, zoneId: zoneId ?? '', net }

  async function place(def: CreatureDef) {
    if (!zoneId) return
    setBusy(def.id); setNote(null)
    try {
      await placeEnemies({ ...ctx, creature: def, count, spread: SPREADS[spread].tiles, anchor: anchorPeer ? { x: anchorPeer.x, y: anchorPeer.y } : null })
      setNote(`${count > 1 ? `${count} ` : ''}${def.name}${count > 1 ? 's' : ''} na cena.`)
    } catch (err) { setNote(err instanceof Error ? err.message : 'Não deu pra colocar.') } finally { setBusy(null) }
  }

  async function remove(ids?: string[]) {
    if (!zoneId) return
    setBusy('rm'); setNote(null)
    try {
      const n = await removeEnemies({ ...ctx, ids })
      setNote(n ? `${n} inimigo${n > 1 ? 's' : ''} tirado${n > 1 ? 's' : ''}.` : 'Nada para tirar.')
    } catch (err) { setNote(err instanceof Error ? err.message : 'Não deu pra tirar.') } finally { setBusy(null) }
  }

  /** Toca pra mim e pra todos (os jogadores da zona, ou da mesa toda). */
  function play(soundId: string) {
    if (creatureSfxEnabled()) playCreatureSound(soundId, volume, distance)
    net?.sfx(soundId, volume, distance, scopeZone ? zoneId : null)
  }

  function toggleLoop(soundId: string) {
    window.clearTimeout(loopTimer.current)
    if (looping === soundId || repeat === 0) {
      setLooping(null)
      if (repeat === 0) play(soundId)
      return
    }
    setLooping(soundId)
    const tick = () => {
      play(soundId)
      const gap = Math.max(repeat, (soundDef(soundId)?.dur ?? 1) + 0.3) * 1000 * (0.75 + Math.random() * 0.5)
      loopTimer.current = window.setTimeout(tick, gap)
    }
    tick()
  }

  const grp = SOUND_GROUPS.find((g) => g.id === group) ?? SOUND_GROUPS[0]

  return (
    <section className="live__block enemy">
      <h4>Inimigos</h4>
      <div className="live__segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'colocar'} className={`live__seg${tab === 'colocar' ? ' live__seg--on' : ''}`} onClick={() => setTab('colocar')}>Colocar</button>
        <button type="button" role="tab" aria-selected={tab === 'zona'} className={`live__seg${tab === 'zona' ? ' live__seg--on' : ''}`} onClick={() => setTab('zona')}>Na zona{enemies.length > 0 ? ` (${enemies.length})` : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'sons'} className={`live__seg${tab === 'sons' ? ' live__seg--on' : ''}`} onClick={() => setTab('sons')}>Sons</button>
      </div>

      {tab === 'colocar' && (
        <>
          <div className="enemy__opts">
            <div className="live__field">
              <label htmlFor="enemy-anchor">Onde</label>
              <select id="enemy-anchor" className="live__select" value={anchorPeer ? anchor : 'spawn'} onChange={(e) => setAnchor(e.target.value)}>
                <option value="spawn">No ponto de partida da zona</option>
                {here.map((p) => <option key={p.id} value={p.id}>Perto de {p.name}</option>)}
              </select>
            </div>
            <div className="live__field">
              <label htmlFor="enemy-count">Quantos</label>
              <select id="enemy-count" className="live__select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="live__chips">
              {SPREADS.map((s, i) => (
                <button key={s.label} type="button" title={s.title} className={`live__chip${spread === i ? ' live__chip--on' : ''}`} onClick={() => setSpread(i)}>{s.label}</button>
              ))}
            </div>
          </div>
          <p className="live__empty">Arraste um inimigo para o mapa, ou use o botão Colocar.</p>
          <ul className="enemy__list">
            {CREATURES.map((c) => (
              <li key={c.id} className="enemy__card enemy__card--drag" draggable onDragStart={(e) => startDrag(e, c)} title="Arraste para o mapa e solte onde quiser">
                <Portrait def={c} />
                <div className="enemy__info">
                  <strong>{c.name}</strong>
                  <small>Dano {c.damage}</small>
                  <span>{c.blurb}</span>
                </div>
                <button type="button" className="btn btn-primary" disabled={!zoneId || busy != null} onClick={() => void place(c)}>
                  {busy === c.id ? '…' : `Colocar${count > 1 ? ` ${count}` : ''}`}
                </button>
              </li>
            ))}
          </ul>
          {note && <p className="live__empty" role="status">{note}</p>}
        </>
      )}

      {tab === 'zona' && (
        <>
          {enemies.length === 0 && <p className="live__empty">Nenhum inimigo nesta zona.</p>}
          <ul className="enemy__list">
            {enemies.map((n) => {
              const def = creatureOfNpc(n.id)
              const g = def ? SOUND_GROUPS.find((x) => x.id === def.sound) : undefined
              return (
                <li key={n.id} className="enemy__card enemy__card--row">
                  {def && <Portrait def={def} size={40} />}
                  <div className="enemy__info">
                    <strong>{n.name}</strong>
                    <small>{controlling === n.id ? 'controlando' : n.role}</small>
                  </div>
                  <div className="enemy__actions">
                    {g?.sounds.slice(0, 2).map((s) => (
                      <button key={s.id} type="button" className="live__chip" onClick={() => play(s.id)} title={`Tocar: ${s.label}`}>🔊 {s.label}</button>
                    ))}
                    <button type="button" className={`live__chip${controlling === n.id ? ' live__chip--on' : ''}`} onClick={() => onControl(n.id)} title="Controlar este inimigo como um jogador (setas ou WASD)">Controlar</button>
                    <button type="button" className="live__chip" disabled={busy != null} onClick={() => void remove([n.id])}>Tirar</button>
                  </div>
                </li>
              )
            })}
          </ul>
          {enemies.length > 1 && (
            <button type="button" className="btn btn-ghost" disabled={busy != null} onClick={() => { if (confirm('Tirar todos os inimigos desta zona?')) void remove() }}>Tirar todos desta zona</button>
          )}
          {note && <p className="live__empty" role="status">{note}</p>}
        </>
      )}

      {tab === 'sons' && (
        <>
          <div className="live__chips">
            {SOUND_GROUPS.map((g) => (
              <button key={g.id} type="button" className={`live__chip${group === g.id ? ' live__chip--on' : ''}`} onClick={() => setGroup(g.id)}>{g.label}</button>
            ))}
          </div>
          <ul className="enemy__sounds">
            {grp.sounds.map((s) => (
              <li key={s.id}>
                <button type="button" className={`live__player${looping === s.id ? ' live__player--on' : ''}`} onClick={() => toggleLoop(s.id)}>
                  <span>🔊 {s.label}</span>
                  <small>{looping === s.id ? 'tocando, clique pra parar' : repeat === 0 ? 'tocar' : 'repetir'}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="live__field">
            <label htmlFor="enemy-vol">Volume</label>
            <input id="enemy-vol" className="live__range" type="range" min={0.1} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          </div>
          <div className="live__chips" title="Quão longe a criatura parece estar">
            {DISTANCES.map((d) => (
              <button key={d.value} type="button" title={d.title} className={`live__chip${distance === d.value ? ' live__chip--on' : ''}`} onClick={() => setDistance(d.value)}>{d.label}</button>
            ))}
          </div>
          <div className="live__chips">
            {REPEATS.map((r) => (
              <button key={r.label} type="button" className={`live__chip${repeat === r.every ? ' live__chip--on' : ''}`} onClick={() => { setRepeat(r.every); if (r.every === 0) { window.clearTimeout(loopTimer.current); setLooping(null) } }}>{r.label}</button>
            ))}
          </div>
          <label className="live__switchrow">
            <input type="checkbox" className="live__switch" checked={scopeZone} onChange={(e) => setScopeZone(e.target.checked)} />
            Só quem está nesta zona ouve
          </label>
          <label className="live__switchrow">
            <input type="checkbox" className="live__switch" checked={mineOn} onChange={(e) => { setMineOn(e.target.checked); setCreatureSfxEnabled(e.target.checked) }} />
            Eu também quero ouvir os sons de criaturas
          </label>
          <p className="live__empty">Os jogadores ouvem junto com você, no volume e na distância que você escolher. Cada um pode desligar esses sons no botão de som da sua tela.</p>
        </>
      )}
    </section>
  )
}
