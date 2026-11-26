import { useState } from 'react'
import { useCurrentCampaign } from '../../../campaigns/CurrentCampaignContext'
import { FEAR_MAX, useFear } from '../services/dhFearService'

// ────────────────────────────────────────────────────────
// O Medo do mestre, à vista de todos no cabeçalho da campanha (só nas campanhas de DaggerHeart): doze caveiras que se enchem de
// roxo conforme o Medo (o mestre também pode clicar nelas). Quem rola com Medo soma 1 sozinho; o mestre muda com os botões (gastar Medo, ajustar).
// ────────────────────────────────────────────────────────

/** Caveira: o crânio com as órbitas, o nariz e os dentes vazados, para o preenchimento aparecer só no osso. */
const SKULL = 'M8 1C4 1 1.5 3.8 1.5 7.4c0 2.2 1 3.8 2.5 4.8V15a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.8c1.5-1 2.5-2.6 2.5-4.8C14.5 3.8 12 1 8 1zM5.5 6.1a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zm5 0a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM8 10.4l1 2H7zM6.7 13.4h.6V16h-.6zm2 0h.6V16h-.6z'

export function Skull({ on, onClick, label, disabled }: { on: boolean; onClick?: () => void; label: string; disabled: boolean }) {
  return (
    <button type="button" className={`dh-skull${on ? ' is-on' : ''}`} onClick={onClick} disabled={disabled} aria-label={label} tabIndex={disabled ? -1 : 0}>
      <svg viewBox="0 0 16 17" aria-hidden="true"><path d={SKULL} fillRule="evenodd" /></svg>
    </button>
  )
}

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
        {Array.from({ length: FEAR_MAX }, (_, i) => (
          <Skull key={i} on={i < value} disabled={!isMaster || failed} label={i + 1 === value ? 'Esvaziar a última caveira' : `Encher até a caveira ${i + 1}`}
            onClick={() => void change(i + 1 === value ? i : i + 1)} />
        ))}
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
