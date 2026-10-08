import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { listMesaArts, type MesaArt } from '../../mesa/services/mesaImagesService'
import type { SceneKind } from '../../mesa/mesaSession'
import './SceneBar.css'

type Menu = 'image' | 'title' | null

const LABEL: Record<SceneKind, string> = {
  game: 'Ao vivo', black: 'Preto', pause: 'Pausa', image: 'Imagem', title: 'Título',
}

/**
 * Cenas, estilo OBS: o mestre escolhe o que os jogadores veem (o jogo ao vivo,
 * tela preta, pausa, uma imagem/mapa ou um título) e vale na hora pra todos.
 */
export function SceneBar({ campaignId }: { campaignId: string }) {
  const mesa = useMesaStream()
  const scene = mesa.stage.scene
  const [menu, setMenu] = useState<Menu>(null)
  const root = useRef<HTMLDivElement>(null)

  // clicar fora ou Esc fecha o menu
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setMenu(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [menu])

  const sceneButton = (kind: SceneKind, children: ReactNode, onClick: () => void) => (
    <button
      type="button"
      className={`scene-btn${scene.kind === kind ? ' scene-btn--on' : ''}`}
      onClick={onClick}
      aria-pressed={scene.kind === kind}
      title={`Jogadores veem: ${LABEL[kind]}`}
    >
      {children}
    </button>
  )

  return (
    <div ref={root} className="scene-bar" role="group" aria-label="Cena dos jogadores">
      <span className="scene-bar__label">
        <span className={`scene-bar__dot${mesa.live ? ' scene-bar__dot--live' : ''}`} aria-hidden="true" />
        Cena
      </span>

      {sceneButton('game', 'Ao vivo', () => { setMenu(null); mesa.setScene({ kind: 'game' }) })}
      {sceneButton('black', 'Preto', () => { setMenu(null); mesa.setScene({ kind: 'black' }) })}
      {sceneButton('pause', 'Pausa', () => { setMenu(null); mesa.setScene({ kind: 'pause' }) })}

      <div className="scene-bar__menu">
        {sceneButton('image', <>Imagem <span aria-hidden="true">▾</span></>, () => setMenu(menu === 'image' ? null : 'image'))}
        {menu === 'image' && <ImagePicker campaignId={campaignId} onPicked={() => setMenu(null)} />}
      </div>

      <div className="scene-bar__menu">
        {sceneButton('title', <>Título <span aria-hidden="true">▾</span></>, () => setMenu(menu === 'title' ? null : 'title'))}
        {menu === 'title' && <TitleForm onDone={() => setMenu(null)} />}
      </div>
    </div>
  )
}

function ImagePicker({ campaignId, onPicked }: { campaignId: string; onPicked: () => void }) {
  const mesa = useMesaStream()
  const [arts, setArts] = useState<MesaArt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const shown = mesa.stage.scene.kind === 'image' ? mesa.stage.scene.id : null

  useEffect(() => {
    let dead = false
    listMesaArts(campaignId)
      .then((list) => { if (!dead) setArts(list) })
      .catch((err) => { if (!dead) setError(err instanceof Error ? err.message : 'Não deu pra carregar as imagens.') })
    return () => { dead = true }
  }, [campaignId])

  async function pick(art: MesaArt) {
    setBusy(art.id)
    setError(null)
    try {
      await mesa.showImage({ id: art.id, path: art.path, name: art.name })
      onPicked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu pra mostrar a imagem.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="scene-pop scene-pop--images" role="dialog" aria-label="Escolher imagem ou mapa">
      {error && <p className="scene-pop__msg scene-pop__msg--error" role="alert">{error}</p>}
      {!arts && !error && <p className="scene-pop__msg">Carregando…</p>}
      {arts && arts.length === 0 && <p className="scene-pop__msg">Sem imagens. Envie na aba Mesa do site.</p>}
      {arts && arts.length > 0 && (
        <ul className="scene-pop__grid">
          {arts.map((art) => (
            <li key={art.id}>
              <button
                type="button"
                className={`scene-thumb${shown === art.id ? ' scene-thumb--on' : ''}`}
                onClick={() => void pick(art)}
                disabled={busy !== null}
                title={art.name}
              >
                {art.url ? <img src={art.url} alt="" loading="lazy" draggable={false} /> : <span>sem prévia</span>}
                <span className="scene-thumb__name">{busy === art.id ? 'Abrindo…' : art.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TitleForm({ onDone }: { onDone: () => void }) {
  const mesa = useMesaStream()
  const current = mesa.stage.scene.kind === 'title' ? mesa.stage.scene : null
  const [title, setTitle] = useState(current?.title ?? '')
  const [subtitle, setSubtitle] = useState(current?.subtitle ?? '')

  function submit() {
    if (!title.trim()) return
    mesa.setScene({ kind: 'title', title: title.trim(), subtitle: subtitle.trim() })
    onDone()
  }

  return (
    <form className="scene-pop scene-pop--title" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <input
        className="scene-pop__input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (ex.: Capítulo 1)"
        maxLength={120}
        autoFocus
      />
      <input
        className="scene-pop__input"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        placeholder="Texto menor (opcional)"
        maxLength={240}
      />
      <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Mostrar</button>
    </form>
  )
}
