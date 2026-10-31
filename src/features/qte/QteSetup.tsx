import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COMPACT_QUERY, useMediaQuery } from '../../shared/lib/useMediaQuery'
import { getCampaignMembers } from '../members/services/memberService'
import { useAuth } from '../auth/AuthProvider'
import { getMyAltheriumSheet } from '../sheets/altherium/services/altheriumSheetService'
import { QTE_IMPULSO_MAX, QTE_LIVES, QTE_TOTAL, difficultyLabel } from './qteEngine'
import { isActive, useQte } from './QteProvider'
import './Qte.css'

// ────────────────────────────────────────────────────────
// Preparo da cena a dois. Abrir o painel já chama todos para assistir
// (QteSession.openLobby); fechar sem iniciar desfaz o convite. Quem joga
// escolhe até 1 parceiro; o mestre põe 1 ou 2 jogadores. Quem for
// convidado precisa aceitar antes de começar.
// ────────────────────────────────────────────────────────

function HeartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2.1 0 3.6 1.2 4.4 2.5h3.2C14.4 6.2 15.9 5 18 5c3.3 0 5.1 3.4 3.6 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

interface Candidate { uid: string; name: string }

/**
 * O conteúdo do painel: quem entra na cena + Iniciar. O jogador sempre joga
 * (e leva até 1 parceiro). O mestre escolhe: só organizar (1 ou 2 jogadores)
 * ou jogar também (ele + 1 jogador, com o Impulso que definir aqui, já que
 * quase nunca tem ficha).
 */
export function QteSetup({ master, impulso, onStarted }: { master: boolean; impulso?: number; onStarted?: () => void }) {
  const qte = useQte()
  const { user } = useAuth()
  const [members, setMembers] = useState<Candidate[]>([])
  const [loaded, setLoaded] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [plays, setPlays] = useState(false)
  const [selfImpulso, setSelfImpulso] = useState(impulso ?? 5)
  const begun = useRef(false)
  const asPlayer = !master || plays

  // Abrir = chamar todo mundo para assistir; fechar sem iniciar = desfazer.
  const { openLobby, closeLobby } = qte
  useEffect(() => {
    const problem = openLobby()
    if (problem) setError(problem)
    return () => { if (!begun.current) closeLobby() }
  }, [openLobby, closeLobby])

  const campaignId = qte.campaignId
  useEffect(() => {
    if (!campaignId) return
    let active = true
    getCampaignMembers(campaignId)
      .then((list) => {
        if (!active) return
        setMembers(list
          .filter((m) => m.role === 'player' && m.user_id !== user?.id)
          .map((m) => ({ uid: m.user_id, name: m.profile.display_name?.trim() || m.profile.email?.split('@')[0] || 'Jogador' })))
      })
      .catch(() => { if (active) setError('Não foi possível carregar os jogadores da campanha.') })
      .finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [campaignId, user?.id])

  // Mestre que tem ficha de Altherium na campanha: começa com o Impulso dela.
  useEffect(() => {
    if (!master || impulso !== undefined || !campaignId) return
    let active = true
    getMyAltheriumSheet(campaignId)
      .then((sheet) => { if (active && sheet) setSelfImpulso(Math.min(QTE_IMPULSO_MAX, Math.max(0, sheet.attr_impulso ?? 0))) })
      .catch(() => { /* fica no padrão */ })
    return () => { active = false }
  }, [master, impulso, campaignId])

  // Em cena são sempre 2 no máximo: quem organiza jogando leva 1 parceiro; o mestre só organizando, 2.
  const max = asPlayer ? 1 : 2
  function toggle(uid: string) {
    setPicked((cur) => {
      if (cur.includes(uid)) return cur.filter((x) => x !== uid)
      if (max === 1) return [uid]
      return cur.length >= max ? [...cur.slice(1), uid] : [...cur, uid]
    })
  }
  function setMode(playing: boolean) {
    setPlays(playing)
    setPicked((cur) => (playing ? cur.slice(0, 1) : cur))
  }

  async function start() {
    if (busy) return
    setBusy(true)
    setError(null)
    const partners = members.filter((m) => picked.includes(m.uid))
    const problem = await qte.begin(partners, asPlayer, master && plays ? { impulso: selfImpulso } : undefined)
    setBusy(false)
    if (problem) { setError(problem); return }
    begun.current = true
    onStarted?.()
  }

  const blocked = isActive(qte.game) && qte.game.organizer.uid !== user?.id
  const canStart = !busy && !blocked && (asPlayer || picked.length > 0)
  const waiting = picked.length > 0
  const shownImpulso = master ? (plays ? selfImpulso : undefined) : impulso

  return (
    <div className="qte-setup">
      <p className="qte-setup__intro">
        {!master
          ? 'Todos da campanha foram chamados para assistir. Escolha com quem fazer a cena (ou vá sozinho) e inicie.'
          : 'Todos foram chamados para assistir. Escolha quem entra na cena: cada jogador convidado precisa aceitar para começar.'}
      </p>

      {master && (
        <>
          <div className="qte-setup__label">Você, mestre</div>
          <ul className="qte-setup__members">
            <li>
              <button type="button" className={`qte-chip${!plays ? ' qte-chip--on' : ''}`} onClick={() => setMode(false)} aria-pressed={!plays}>Só organizar</button>
            </li>
            <li>
              <button type="button" className={`qte-chip${plays ? ' qte-chip--on' : ''}`} onClick={() => setMode(true)} aria-pressed={plays}>Jogar também</button>
            </li>
          </ul>
          {plays && (
            <div className="qte-stepper" role="group" aria-label="Impulso do mestre na cena">
              <span className="qte-setup__label">Seu Impulso na cena</span>
              <div className="qte-stepper__ctl">
                <button type="button" className="qte-stepper__btn" onClick={() => setSelfImpulso((v) => Math.max(0, v - 1))} disabled={selfImpulso <= 0} aria-label="Diminuir o Impulso">−</button>
                <output className="qte-stepper__val" aria-live="polite">{selfImpulso}</output>
                <button type="button" className="qte-stepper__btn" onClick={() => setSelfImpulso((v) => Math.min(QTE_IMPULSO_MAX, v + 1))} disabled={selfImpulso >= QTE_IMPULSO_MAX} aria-label="Aumentar o Impulso">+</button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="qte-setup__label">
        {!master ? 'Parceiro (opcional, no máximo 1)' : plays ? 'Outro jogador (opcional, no máximo 1)' : 'Jogadores da cena (1 ou 2)'}
      </div>
      {!loaded && <p className="qte-setup__hint">Carregando jogadores…</p>}
      {loaded && members.length === 0 && <p className="qte-setup__hint">Nenhum outro jogador na campanha{asPlayer ? ': você vai sozinho.' : '.'}</p>}
      <ul className="qte-setup__members">
        {asPlayer && (
          <li>
            <button type="button" className={`qte-chip${picked.length === 0 ? ' qte-chip--on' : ''}`} onClick={() => setPicked([])} aria-pressed={picked.length === 0}>
              Sozinho
            </button>
          </li>
        )}
        {members.map((m) => (
          <li key={m.uid}>
            <button type="button" className={`qte-chip${picked.includes(m.uid) ? ' qte-chip--on' : ''}`} onClick={() => toggle(m.uid)} aria-pressed={picked.includes(m.uid)}>
              {m.name}
            </button>
          </li>
        ))}
      </ul>

      <ul className="qte-setup__rules">
        <li>Aparecem letras do teclado pela tela: aperte a tecla (ou toque na letra) antes que ela suma.</li>
        <li>A cada letra o tempo encurta. {QTE_LIVES} falhas (tecla errada ou letra que sumiu) e você perde; aguente {QTE_TOTAL} letras para vencer.</li>
        <li>
          Quanto mais Impulso, mais tempo você tem — só com Impulso 10 fica relativamente tranquilo.
          {typeof shownImpulso === 'number' && <strong> O seu: {shownImpulso} · {difficultyLabel(shownImpulso)}.</strong>}
        </li>
      </ul>

      {error && <p className="qte-setup__error" role="alert">{error}</p>}
      {blocked && <p className="qte-setup__hint">{qte.game?.organizer.name} já está com uma cena em andamento.</p>}

      <button type="button" className="btn btn-primary qte-go" onClick={() => void start()} disabled={!canStart}>
        <HeartIcon /> {busy ? 'Chamando…' : waiting ? 'Iniciar e convidar' : 'Iniciar'}
      </button>
    </div>
  )
}

/** O botão "Sexo" da ficha: abre o painel suspenso com o preparo e o Iniciar (no celular e no tablet, uma folha que sobe da base da tela). */
export function QteSheetButton({ ownerId, impulso }: { ownerId: string; impulso: number }) {
  const { user } = useAuth()
  const qte = useQte()
  const compact = useMediaQuery(COMPACT_QUERY)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  // A folha cobre a tela: a página de trás não rola enquanto ela está aberta.
  useEffect(() => {
    if (!open || !compact) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, compact])

  // O dono da ficha joga a cena; o mestre (que não joga) organiza de qualquer ficha. Observador não vê.
  const owner = !!user && user.id === ownerId
  if (!qte.enabled || !user || (!owner && !qte.isMaster)) return null

  const setup = <QteSetup master={!owner} impulso={owner ? impulso : undefined} onStarted={() => setOpen(false)} />

  return (
    <div className="qte-entry" ref={wrapRef}>
      <button type="button" className={`qte-entry__btn${open ? ' qte-entry__btn--open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog">
        <HeartIcon /> Sexo
      </button>
      {open && !compact && (
        <div className="qte-entry__menu" role="dialog" aria-label="Cena a dois" ref={menuRef}>
          {setup}
        </div>
      )}
      {open && compact && createPortal(
        <div className="qte-sheet" role="presentation">
          <div className="qte-sheet__scrim" onClick={() => setOpen(false)} />
          <div className="qte-sheet__panel" role="dialog" aria-modal="true" aria-label="Cena a dois" ref={menuRef}>
            <div className="qte-sheet__grip" aria-hidden="true" />
            <button type="button" className="qte-sheet__close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            {setup}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
