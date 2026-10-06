import { useCallback, useState } from 'react'
import { Presence } from '../../shared/components/Presence'
import { useFloatingPanel } from '../../shared/lib/floatingPanels'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { SITE_FEATURES, setFeature, useIsSiteOwner, useSiteFeatures, type FeatureContext, type SiteFeature } from './siteFeatures'
import './ControlFab.css'

// ────────────────────────────────────────────────────────
// Painel de controle do dono do site: o livro vinho em cima do sino. Só
// aparece pro dono do site (app_owners). Lista os recursos de SITE_FEATURES e
// deixa cada um GUARDADO (só o dono vê) ou NO SITE (todo mundo vê).
// ────────────────────────────────────────────────────────

function whenText(iso: string | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** O livro vinho no canto (escondido por enquanto, a pedido). */
const CONTROL_FAB_ON = false

export function ControlFab() {
  const owner = useIsSiteOwner()
  const [isOpen, setIsOpen] = useState(false)
  const close = useCallback(() => setIsOpen(false), [])
  const { instant } = useFloatingPanel('control', isOpen, close)

  if (!owner || !CONTROL_FAB_ON) return null

  return (
    <>
      {(isOpen || !instant) && (
        <Presence show={isOpen} exitMs={180}>
          {(state) => (
            <div className="control-panel fab-panel anim-pop" data-state={state} data-fab-panel="control" role="dialog" aria-label="Painel de controle">
              <div className="control-panel__head">
                <BookIcon />
                <div className="control-panel__titles">
                  <span className="control-panel__title">Painel de controle</span>
                  <span className="control-panel__sub">Só você vê isto</span>
                </div>
                <button type="button" className="control-panel__close" onClick={close} aria-label="Fechar o painel de controle">✕</button>
              </div>
              <ControlList />
              <div className="control-panel__foot">
                <span>Guardado: só você vê, pra testar. No site: todo mundo vê.</span>
              </div>
            </div>
          )}
        </Presence>
      )}
      <button
        type="button"
        className={`control-fab${isOpen ? ' control-fab--open' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Painel de controle"
        aria-expanded={isOpen}
        title="Painel de controle"
      >
        <BookIcon />
      </button>
    </>
  )
}

function ControlList() {
  const { loaded, rows } = useSiteFeatures()
  if (!loaded) return <div className="control-panel__state"><div className="spinner spinner--sm" /> Carregando…</div>
  if (SITE_FEATURES.length === 0) {
    return (
      <div className="control-panel__state control-panel__state--empty">
        <p>Nada guardado por enquanto.</p>
        <p>Os recursos novos que a gente criar aparecem aqui, guardados, e você decide quando vão pro site.</p>
      </div>
    )
  }
  return (
    <ul className="control-panel__list">
      {SITE_FEATURES.map((f) => <ControlItem key={f.key} feature={f} on={rows[f.key]?.enabled === true} changedAt={rows[f.key]?.updated_at} />)}
    </ul>
  )
}

function ControlItem({ feature, on, changedAt }: { feature: SiteFeature; on: boolean; changedAt?: string }) {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const ctx: FeatureContext = {
    userId: user?.id ?? null,
    campaign: campaign ? { id: campaign.id, name: campaign.name, master: campaign.role === 'master' } : null,
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  async function act(a: NonNullable<SiteFeature['actions']>[number]) {
    setBusy(true)
    setError(null)
    setDone(null)
    try { const msg = await a.run(user?.id ?? null, ctx); setDone(msg || 'Feito.') } catch (e) { setError(e instanceof Error ? e.message : 'Não deu certo.') } finally { setBusy(false) }
  }
  async function toggle() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await setFeature(feature.key, !on)
      const msg = await feature.onToggle?.(!on, ctx)
      if (msg) setDone(msg)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não deu certo.') } finally { setBusy(false) }
  }
  const when = whenText(changedAt)
  return (
    <li className={`control-item${on ? ' control-item--on' : ''}`}>
      <div className="control-item__text">
        <span className="control-item__name">{feature.name}</span>
        <span className="control-item__desc">{feature.description}</span>
        <span className="control-item__meta">{feature.where}{when ? ` · mudou em ${when}` : ''}</span>
        {feature.actions && (
          <div className="control-item__actions">
            {feature.actions.map((a) => (
              <button key={a.label} type="button" className="control-item__action" onClick={() => void act(a)} disabled={busy}>{a.label}</button>
            ))}
            {done && <span className="control-item__done" role="status">{done}</span>}
          </div>
        )}
        {!feature.actions && done && <span className="control-item__done" role="status">{done}</span>}
        {error && <span className="control-item__error" role="alert">{error}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className="control-item__switch"
        onClick={() => void toggle()}
        disabled={busy}
        aria-label={`${feature.name}: ${on ? 'no site' : 'guardado'}`}
      >
        <span className="control-item__knob" aria-hidden="true" />
        <span className="control-item__state">{on ? 'No site' : 'Guardado'}</span>
      </button>
    </li>
  )
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7M9 11h5" />
    </svg>
  )
}
