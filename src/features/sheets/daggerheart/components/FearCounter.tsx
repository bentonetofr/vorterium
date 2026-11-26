import { useState } from 'react'
import { useCurrentCampaign } from '../../../campaigns/CurrentCampaignContext'
import { FEAR_MAX, useFear } from '../services/dhFearService'

// ────────────────────────────────────────────────────────
// O Medo do mestre, à vista de todos no cabeçalho da campanha (só nas campanhas de DaggerHeart): doze caveiras roxas
// que acendem conforme o Medo. Quem rola com Medo soma 1 sozinho; o mestre muda com os botões (gastar Medo, ajustar).
// ────────────────────────────────────────────────────────

export function FearCounter({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  const { campaign } = useCurrentCampaign()
  const { value, loaded, failed, set } = useFear(campaignId)
  const [error, setError] = useState<string | null>(null)
  if (campaign?.id !== campaignId || campaign.system !== 'daggerheart') return null

  async function change(v: number) {
    setError(null)
    try { await set(v) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível mudar o Medo.') }
  }

  return (
    <span className="dh-fear" title={failed ? 'A migration do Medo ainda não rodou' : 'O Medo do mestre: ele gasta para agir contra o grupo'} data-state={loaded ? (failed ? 'failed' : 'ok') : 'loading'}>
      <span className="dh-fear__label">Medo</span>
      <span className="dh-fear__skulls" role="img" aria-label={`Medo do mestre: ${value} de ${FEAR_MAX}`}>
        {Array.from({ length: FEAR_MAX }, (_, i) => <i key={i} className={i < value ? 'is-on' : ''} />)}
      </span>
      <b className="dh-fear__n">{failed ? '—' : value}</b>
      {isMaster && !failed && (
        <span className="dh-fear__ctl">
          <button type="button" onClick={() => void change(value - 1)} disabled={value <= 0} aria-label="Gastar 1 Medo">−</button>
          <button type="button" onClick={() => void change(value + 1)} disabled={value >= FEAR_MAX} aria-label="Somar 1 Medo">+</button>
        </span>
      )}
      {error && <small className="dh-fear__err" role="alert">{error}</small>}
    </span>
  )
}
