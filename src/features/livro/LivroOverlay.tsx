import { useEffect, useMemo, useRef, useState } from 'react'
import { gm, type LivroRoomRow } from './livroService'
import { connectLivro, type LivroNet, type NetPeer } from './livroNet'
import { LivroGameView } from './LivroGameView'
import { LivroLobby } from './LivroLobby'
import { useLivroView } from './useLivroRoom'
import { spritePedestal } from './game/art'
import { useFeature } from '../control/siteFeatures'
import { openRoom as openTorre, TORRE_FEATURE } from '../torre/torreService'
import { LivroGmPanel } from './LivroGmPanel'
import { onSoundChange, setSoundOn, sfx, soundOn } from './game/sound'
import './Livro.css'

// ────────────────────────────────────────────────────────
// O Livro Bloqueado cobre o site inteiro. O navegador só deixa entrar em
// tela cheia depois de um clique, então a primeira tela é o cartão "clique
// para entrar" — o clique já liga a tela cheia. Depois: saguão ou partida.
// No canto, um menu pequeno: tela cheia, voltar ao site e (Mestre) voltar
// ao saguão ou encerrar.
// ────────────────────────────────────────────────────────

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600;700&display=swap'

// O site por baixo não rola enquanto houver um jogo na tela. Contador: na
// troca de jogo um sai e outro entra, e o que sai não pode destravar.
let bodyLocks = 0
let bodyPrev = ''
/** "Já entrou num dos joguinhos nesta aba" (sessionStorage). */
export const ANY_GAME_KEY = 'vorterium:jogo-entrou'

export function useBodyLock() {
  useEffect(() => {
    if (bodyLocks++ === 0) { bodyPrev = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    return () => {
      if (--bodyLocks > 0) return
      document.body.style.overflow = bodyPrev
      // Jogo encerrado: sai da tela cheia. Numa troca, o outro jogo entra
      // logo em seguida e a tela cheia continua.
      window.setTimeout(() => {
        if (bodyLocks === 0 && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      }, 1500)
    }
  }, [])
}

/**
 * O cartão curto da troca de jogo (1,5 s): quem já tinha entrado volta
 * direto pro jogo, mas vê o nome dele antes — todo mundo entende que trocou.
 */
export function useSwitchCard(already: boolean) {
  const [show, setShow] = useState(already)
  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(false), 1500)
    return () => window.clearTimeout(t)
  }, [show])
  return show
}

export function SwitchCard({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="lb-switch" role="status" aria-live="polite">
      <span className="lb-kicker">{kicker}</span>
      <span className="lb-title">{title}</span>
    </div>
  )
}

/**
 * "Reconectando…": aparece quando o ao vivo (os bonecos andando) caiu há
 * mais de 3 s. Some sozinho quando volta. Na entrada, espera 6 s antes.
 */
export function LiveBadge({ net }: { net: { onLive: (cb: (live: boolean) => void) => () => void } | null }) {
  const [down, setDown] = useState(false)
  useEffect(() => {
    if (!net) return
    let t: number | undefined
    let first = true
    const off = net.onLive((live) => {
      window.clearTimeout(t)
      if (live) { setDown(false); first = false; return }
      t = window.setTimeout(() => setDown(true), first ? 6000 : 3000)
    })
    return () => { off(); window.clearTimeout(t) }
  }, [net])
  if (!down) return null
  return <p className="lb-net-off" role="status">Reconectando ao vivo… os bonecos voltam a andar em instantes.</p>
}

export function usePixelFont() {
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

/** Entra em tela cheia (só funciona dentro de um clique) e trava o Esc. */
export function enterFullscreen() {
  if (document.fullscreenElement) return
  void document.documentElement.requestFullscreen?.()
    .then(() => keyboardApi()?.lock?.(['Escape']))
    .catch(() => {})
}

export function useFullscreen() {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const f = () => {
      setFull(!!document.fullscreenElement)
      if (!document.fullscreenElement) keyboardApi()?.unlock?.()
    }
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const enter = enterFullscreen
  const exit = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}) }
  return { full, enter, exit }
}

export function LivroOverlay({ room, onMinimize }: { room: LivroRoomRow; onMinimize: () => void }) {
  usePixelFont()
  const { view, error } = useLivroView(room.id, room.version)
  const enteredKey = `lb-entrou:${room.id}`
  // Quem já entrou num dos jogos nesta aba não precisa clicar de novo (troca de jogo).
  const [entered, setEntered] = useState(() => { try { return sessionStorage.getItem(enteredKey) === '1' || sessionStorage.getItem(ANY_GAME_KEY) === '1' } catch { return false } })
  const [net, setNet] = useState<LivroNet | null>(null)
  const [peers, setPeers] = useState<NetPeer[]>([])
  const [menu, setMenu] = useState(false)
  const fs = useFullscreen()

  // O site por baixo não rola; quando o jogo some de vez (o mestre
  // encerrou), a tela cheia sai junto — mas não numa troca de jogo.
  useBodyLock()
  const switching = useSwitchCard(entered)
  const torre = useFeature(TORRE_FEATURE)

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
    try { sessionStorage.setItem(enteredKey, '1'); sessionStorage.setItem(ANY_GAME_KEY, '1') } catch { /* sem storage */ }
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

  // Clique de qualquer botão do jogo, e o som ligado/desligado.
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onDown = (e: PointerEvent) => { if ((e.target as HTMLElement).closest('button')) sfx('click') }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [])
  const [sound, setSound] = useState(soundOn)
  useEffect(() => onSoundChange(setSound), [])
  const [gmOpen, setGmOpen] = useState(false)

  const isGm = !!view?.me.gm
  const playing = view?.room.status === 'jogo'

  return (
    <div ref={rootRef} className="lb-overlay" role="dialog" aria-modal="true" aria-label="O Livro Bloqueado">
      {entered && switching && <SwitchCard kicker="A biblioteca de Caatedrum" title="O Livro Bloqueado" />}
      <LiveBadge net={net} />
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

      {entered && view && isGm && playing && gmOpen && <LivroGmPanel view={view} onClose={() => setGmOpen(false)} />}

      {entered && view && (
        <div className="lb-menu" ref={menuRef}>
          <button type="button" className="lb-menu__btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu">
            <span /><span /><span />
          </button>
          {menu && (
            <div className="lb-menu__list lb-frame" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); if (fs.full) fs.exit(); else fs.enter() }}>{fs.full ? 'Sair da tela cheia' : 'Tela cheia'}</button>
              <button type="button" role="menuitem" onClick={() => setSoundOn(!sound)} aria-pressed={sound}>{sound ? 'Som: ligado' : 'Som: desligado'}</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); minimize() }}>Voltar ao site</button>
              {isGm && playing && <button type="button" role="menuitem" onClick={() => { setMenu(false); setGmOpen(true) }}>Painel do mestre</button>}
              {isGm && torre.visible && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); void openTorre(room.campaign_id).catch((e) => window.alert(e instanceof Error ? e.message : 'Não deu certo.')) }}>Trocar para A Torre do Observatório</button>
              )}
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
