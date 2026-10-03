import { useEffect, useMemo, useRef, useState } from 'react'
import { gm, type LivroRoomRow } from './livroService'
import { connectLivro, type LivroNet, type NetPeer } from './livroNet'
import { LivroGameView } from './LivroGameView'
import { LivroLobby } from './LivroLobby'
import { useLivroView } from './useLivroRoom'
import { spritePedestal } from './game/art'
import './Livro.css'

// ────────────────────────────────────────────────────────
// O Livro Bloqueado cobre o site inteiro. O navegador só deixa entrar em
// tela cheia depois de um clique, então a primeira tela é o cartão "clique
// para entrar" — o clique já liga a tela cheia. Depois: saguão ou partida.
// No canto, um menu pequeno: tela cheia, voltar ao site e (Mestre) voltar
// ao saguão ou encerrar.
// ────────────────────────────────────────────────────────

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600;700&display=swap'

function usePixelFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = FONT_HREF
    document.head.appendChild(l)
  }, [])
}

// Em tela cheia, o navegador usa o Esc pra sair dela. Travando o Esc
// (Chrome/Edge), ele volta a fechar as janelas do jogo — e segurar o Esc
// ainda sai da tela cheia. Onde não existe, fica como era.
type KeyboardLock = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void }
const keyboardApi = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard

function useFullscreen() {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const f = () => {
      setFull(!!document.fullscreenElement)
      if (!document.fullscreenElement) keyboardApi()?.unlock?.()
    }
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const enter = () => {
    if (document.fullscreenElement) return
    void document.documentElement.requestFullscreen?.()
      .then(() => keyboardApi()?.lock?.(['Escape']))
      .catch(() => {})
  }
  const exit = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}) }
  return { full, enter, exit }
}

export function LivroOverlay({ room, onMinimize }: { room: LivroRoomRow; onMinimize: () => void }) {
  usePixelFont()
  const { view, error } = useLivroView(room.id, room.version)
  const enteredKey = `lb-entrou:${room.id}`
  const [entered, setEntered] = useState(() => { try { return sessionStorage.getItem(enteredKey) === '1' } catch { return false } })
  const [net, setNet] = useState<LivroNet | null>(null)
  const [peers, setPeers] = useState<NetPeer[]>([])
  const [menu, setMenu] = useState(false)
  const fs = useFullscreen()

  // O site por baixo não rola. E quando o jogo some (o mestre encerrou),
  // a tela cheia sai junto.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Uma conexão ao vivo por sala.
  const meUid = view?.me.uid ?? null
  const meName = useMemo(() => view?.members.find((m) => m.uid === meUid)?.name ?? 'Alguém', [view?.members, meUid])
  useEffect(() => {
    if (!meUid) return
    const n = connectLivro(room.id, { uid: meUid, name: meName, slot: null, gm: false, panel: null })
    setNet(n)
    const off = n.onPeers(setPeers)
    return () => { off(); n.close(); setNet(null) }
    // (o nome e o papel entram pelo setMe abaixo — não reconecta por isso)
  }, [room.id, meUid])
  useEffect(() => { net?.setMe({ name: meName, slot: view?.me.slot ?? null, gm: view?.me.gm ?? false }) }, [net, meName, view?.me.slot, view?.me.gm])

  const enter = () => {
    fs.enter()
    setEntered(true)
    try { sessionStorage.setItem(enteredKey, '1') } catch { /* sem storage */ }
  }
  const minimize = () => { fs.exit(); onMinimize() }

  // Esc com o menu aberto fecha o menu.
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    const onDown = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown) }
  }, [menu])

  const isGm = !!view?.me.gm
  const playing = view?.room.status === 'jogo'

  return (
    <div className="lb-overlay" role="dialog" aria-modal="true" aria-label="O Livro Bloqueado">
      {!entered || !view ? (
        <TitleCard
          ready={!!view}
          error={error}
          role={view ? (view.me.slot !== null ? `Você joga de ${view.me.slot === 0 ? 'Capa Azul' : 'Capa Vermelha'}` : view.me.gm ? 'Você é o Mestre' : 'Você vai assistir') : null}
          onEnter={enter}
        />
      ) : view.room.status === 'lobby' ? (
        <LivroLobby view={view} peers={peers} />
      ) : net ? (
        <LivroGameView view={view} net={net} peers={peers} />
      ) : null}

      {entered && view && (
        <div className="lb-menu" ref={menuRef}>
          <button type="button" className="lb-menu__btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu">
            <span /><span /><span />
          </button>
          {menu && (
            <div className="lb-menu__list lb-frame" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); if (fs.full) fs.exit(); else fs.enter() }}>{fs.full ? 'Sair da tela cheia' : 'Tela cheia'}</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); minimize() }}>Voltar ao site</button>
              {isGm && playing && <button type="button" role="menuitem" onClick={() => { setMenu(false); void gm(room.id, { a: 'lobby' }) }}>Trocar quem joga</button>}
              {isGm && (
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenu(false); if (window.confirm('Encerrar o Livro Bloqueado pra todo mundo?')) void gm(room.id, { a: 'close' }) }}>Encerrar o jogo</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TitleCard({ ready, error, role, onEnter }: { ready: boolean; error: string | null; role: string | null; onEnter: () => void }) {
  const art = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = art.current
    if (!c) return
    const s = spritePedestal()
    c.width = s.width * 5
    c.height = s.height * 5
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(s, 0, 0, c.width, c.height)
  }, [])
  useEffect(() => {
    if (!ready) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEnter() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, onEnter])
  return (
    <button type="button" className="lb-title-card" onClick={() => { if (ready) onEnter() }} disabled={!ready}>
      <canvas ref={art} className="lb-title-card__art" aria-hidden="true" />
      <span className="lb-kicker">A biblioteca de Caatedrum</span>
      <span className="lb-title">O Livro Bloqueado</span>
      {role && <span className="lb-title-card__role">{role}</span>}
      {error
        ? <span className="lb-flash">{error}</span>
        : <span className="lb-title-card__go">{ready ? 'Clique para entrar' : 'Abrindo…'}</span>}
    </button>
  )
}
