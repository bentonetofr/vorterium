import { useEffect, useRef, useState } from 'react'
import { getCampaignMembers } from '../members/services/memberService'
import { useAuth } from '../auth/AuthProvider'
import { QTE_LIVES, QTE_TOTAL, difficultyLabel } from './qteEngine'
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

/** O conteúdo do painel: quem entra na cena + Iniciar. `asPlayer` = quem abriu também joga. */
export function QteSetup({ asPlayer, impulso, onStarted }: { asPlayer: boolean; impulso?: number; onStarted?: () => void }) {
  const qte = useQte()
  const { user } = useAuth()
  const [members, setMembers] = useState<Candidate[]>([])
  const [loaded, setLoaded] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const begun = useRef(false)

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

  const max = asPlayer ? 1 : 2
  function toggle(uid: string) {
    setPicked((cur) => {
      if (cur.includes(uid)) return cur.filter((x) => x !== uid)
      if (max === 1) return [uid]
      return cur.length >= max ? [...cur.slice(1), uid] : [...cur, uid]
    })
  }

  async function start() {
    if (busy) return
    setBusy(true)
    setError(null)
    const partners = members.filter((m) => picked.includes(m.uid))
    const problem = await qte.begin(partners, asPlayer)
    setBusy(false)
    if (problem) { setError(problem); return }
    begun.current = true
    onStarted?.()
  }

  const blocked = isActive(qte.game) && qte.game.organizer.uid !== user?.id
  const canStart = !busy && !blocked && (asPlayer || picked.length > 0)
  const waiting = picked.length > 0

  return (
    <div className="qte-setup">
      <p className="qte-setup__intro">
        {asPlayer
          ? 'Todos da campanha foram chamados para assistir. Escolha com quem fazer a cena (ou vá sozinho) e inicie.'
          : 'Todos foram chamados para assistir. Escolha 1 ou 2 jogadores para a cena: cada um precisa aceitar para começar.'}
      </p>

      <div className="qte-setup__label">{asPlayer ? 'Parceiro (opcional, no máximo 1)' : 'Jogadores da cena (1 ou 2)'}</div>
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
          {typeof impulso === 'number' && <strong> O seu: {impulso} · {difficultyLabel(impulso)}.</strong>}
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

/** O botão "Sexo" da ficha: abre o painel suspenso com o preparo e o Iniciar. */
export function QteSheetButton({ ownerId, impulso }: { ownerId: string; impulso: number }) {
  const { user } = useAuth()
  const qte = useQte()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  // só a dona/o dono da ficha (e quem não é observador) abre a cena
  if (!qte.enabled || !user || user.id !== ownerId) return null

  return (
    <div className="qte-entry" ref={wrapRef}>
      <button type="button" className={`qte-entry__btn${open ? ' qte-entry__btn--open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog">
        <HeartIcon /> Sexo
      </button>
      {open && (
        <div className="qte-entry__menu" role="dialog" aria-label="Cena a dois">
          <QteSetup asPlayer impulso={impulso} onStarted={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
