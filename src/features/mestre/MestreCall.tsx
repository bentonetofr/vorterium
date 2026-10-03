import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { useFeature, useIsSiteOwner } from '../control/siteFeatures'
import {
  MESTRE_FEATURE, callMestre, cancelMestreCall, loadCampaignMestre, markSeen, ownerTestMestre,
  playAscension, setMyMestre, subscribeCampaignMestre, useMestreState, type CampaignMestre,
} from './mestreService'

// ────────────────────────────────────────────────────────
// O botão SE TORNAR UM MESTRE, no meio da tela dos jogadores de uma
// campanha de Altherium — só depois que o dono do site LIGA a Raiz Mestre
// no Painel de controle (guardada, ninguém vê; nem ele). Cada
// um aperta; quando TODOS os jogadores apertaram, a campanha ascende e a
// animação roda pra todos juntos. Dá pra desistir, e minimizar enquanto
// espera. O dono do site (quando não é jogador da campanha) aperta sozinho
// e só ele vira Mestre — é o teste dele.
// ────────────────────────────────────────────────────────

export function MestreCall() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const feature = useFeature(MESTRE_FEATURE)
  const owner = useIsSiteOwner()
  const { mestre } = useMestreState()
  const [state, setState] = useState<CampaignMestre | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mini, setMini] = useState(false)
  const played = useRef(false)

  const campaignId = campaign?.id ?? null
  const isPlayer = campaign?.role === 'player'
  const eligible = !!campaignId && campaign?.system === 'altherium' && feature.on && (isPlayer || owner) && mestre === false

  const ascend = useCallback(() => {
    if (played.current || !user?.id) return
    played.current = true
    markSeen(user.id)
    playAscension()
    setMyMestre(true)
  }, [user?.id])

  const reload = useCallback(async () => {
    if (!campaignId) return
    try { setState(await loadCampaignMestre(campaignId)) } catch { setState(null) }
  }, [campaignId])

  useEffect(() => {
    if (!eligible || !campaignId) return
    played.current = false
    void reload()
    return subscribeCampaignMestre(campaignId, (what) => {
      // A campanha ascendeu: quem é jogador dela vira Mestre agora (o banco já converteu).
      if (what === 'ascended' && isPlayer) ascend()
      else void reload()
    })
  }, [eligible, campaignId, isPlayer, reload, ascend])

  if (!eligible || !user) return null
  // Campanha que já ascendeu (e eu, jogador, ainda não "vi"): o tema cuida (MestreTheme).
  if (state?.ascended && isPlayer) return null

  const testing = owner && !isPlayer
  const pressed = !testing && !!state?.calls.includes(user.id)
  const total = state?.players.length ?? 0
  const ready = state ? state.calls.filter((id) => state.players.includes(id)).length : 0

  async function press() {
    if (!campaignId || busy) return
    setBusy(true)
    setError(null)
    try {
      if (testing) {
        await ownerTestMestre(campaignId)
        ascend()
        return
      }
      const r = await callMestre(campaignId)
      if (r.ascended) ascend()
      else await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível.')
    } finally {
      setBusy(false)
    }
  }

  async function giveUp() {
    if (!campaignId || !user || busy) return
    setBusy(true)
    try { await cancelMestreCall(campaignId, user.id); await reload() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível.') } finally { setBusy(false) }
  }

  if (mini) {
    return (
      <button type="button" className="mestre-call-pill" onClick={() => setMini(false)}>
        <span className="mestre-call-pill__star" aria-hidden="true">✦</span>
        {pressed ? `Mestre: ${ready} de ${total} prontos` : 'Se tornar um Mestre'}
      </button>
    )
  }

  return (
    <div className="mestre-call" role="dialog" aria-label="Se tornar um Mestre">
      <div className="mestre-call__card">
        <button type="button" className="mestre-call__min" onClick={() => setMini(true)} aria-label="Minimizar" title="Minimizar">–</button>
        <span className="mestre-call__crest" aria-hidden="true">✦</span>
        <p className="mestre-call__lead">
          {testing ? 'Teste do dono do site — só você vira Mestre.' : 'Vocês estudaram o suficiente. Berserker, Runaskin e Pilar — tudo de uma vez.'}
        </p>
        {!pressed ? (
          <button type="button" className="mestre-call__btn" onClick={() => void press()} disabled={busy}>
            SE TORNAR UM MESTRE
          </button>
        ) : (
          <div className="mestre-call__wait" role="status">
            <span className="mestre-call__count">{ready} de {total}</span>
            <span>jogadores prontos. Esperando os outros…</span>
            <div className="mestre-call__dots" aria-hidden="true">
              {state?.players.map((id) => <span key={id} className={`mestre-call__dot${state.calls.includes(id) ? ' is-on' : ''}`} />)}
            </div>
            <button type="button" className="mestre-call__giveup" onClick={() => void giveUp()} disabled={busy}>Desistir</button>
          </div>
        )}
        {!testing && !pressed && <p className="mestre-call__hint">Todos os jogadores da campanha precisam apertar.</p>}
        {error && <p className="mestre-call__error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
