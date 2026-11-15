import { useState } from 'react'
import { alertDialog } from '../../../shared/components/dialogs'
import { closedReason, playersNeeded, setCampaignSession, useLiveSession, type SessionAction, type SessionReason } from '../services/liveSession'
import { formatStart } from '../utils/sessionTime'
import './SessionLiveBadge.css'

// ────────────────────────────────────────────────────────
// O selo "Sessão aberta" do cabeçalho da campanha. A sessão só abre com o mestre ativo: ele abre ou encerra pelo botão, e o site também
// reconhece sozinho (horário marcado, ou pelo menos a metade dos jogadores online). Jogador vê o selo, mas não tem botão.
// ────────────────────────────────────────────────────────

const WHY: Record<SessionReason, { label: string; tip: string }> = {
  manual: { label: 'aberta pelo mestre', tip: 'O mestre abriu a sessão' },
  scheduled: { label: 'horário marcado', tip: 'No horário marcado da sessão' },
  together: { label: 'mesa reunida', tip: 'O mestre e pelo menos a metade dos jogadores estão online' },
}

export function SessionLiveBadge({ campaignId, isMaster = false }: { campaignId: string; isMaster?: boolean }) {
  const s = useLiveSession(campaignId)
  const [busy, setBusy] = useState(false)
  if (!s.known) return null

  async function act(action: SessionAction) {
    setBusy(true)
    try { await setCampaignSession(campaignId, action) }
    catch (err) { void alertDialog(err instanceof Error ? err.message : 'Não foi possível mudar a sessão.') }
    finally { setBusy(false) }
  }

  const need = playersNeeded(s.playersTotal)
  const why = closedReason(s)
  const crowd = s.playersTotal > 0 ? ` Jogadores online: ${s.playersOnline} de ${s.playersTotal} (a mesa conta como reunida com ${need}).` : ''

  if (s.open && s.reason) {
    return (
      <span className="live-wrap">
        <span className="live-badge live-badge--open" role="status" title={`${WHY[s.reason].tip}.${crowd} As conquistas e os conjuntos de dados só contam rolagens feitas agora.`}>
          <i aria-hidden="true" />
          Sessão aberta
          <small>{WHY[s.reason].label}</small>
        </span>
        {isMaster && <button type="button" className="live-btn" disabled={busy} onClick={() => void act('close')} title="Fecha a sessão por 6 horas (ou até você abrir de novo)">Encerrar sessão</button>}
      </span>
    )
  }

  // sem resposta do banco (a migration da sessão ainda não rodou, ou sem rede): melhor dizer do que ficar sem selo
  if (s.failed) {
    return (
      <span className="live-badge live-badge--closed" title={`Não foi possível conferir o estado da sessão. Se isto não passar, as migrations 20240233 a 20240235 podem não ter rodado no Supabase. Enquanto isso, nenhuma rolagem conta pras conquistas.${s.errorText ? ` Resposta do banco: ${s.errorText}` : ''}`}>
        Sessão indisponível
      </span>
    )
  }

  if (isMaster) {
    return (
      <span className="live-wrap">
        <span className="live-badge live-badge--closed" title={`A sessão abre sozinha no horário marcado ou quando pelo menos a metade dos jogadores estiver online com você.${crowd}`}>
          {s.override === 'closed' ? 'Sessão encerrada' : 'Sessão fechada'}
          {why && s.override !== 'closed' && <small>{why}</small>}
          {s.nextAt && <small>próxima: {formatStart(s.nextAt)}</small>}
        </span>
        <button type="button" className="live-btn live-btn--go" disabled={busy} onClick={() => void act('open')} title="Abre a sessão agora: a partir daqui as rolagens contam pras conquistas">Abrir sessão</button>
        {s.override === 'closed' && <button type="button" className="live-link" disabled={busy} onClick={() => void act('auto')} title="Deixa o site decidir sozinho de novo">voltar ao automático</button>}
      </span>
    )
  }

  // jogador: o selo fica sempre, pra ele saber em que pé está (fechada, e por quê)
  return (
    <span className="live-badge live-badge--closed" title={`Só o mestre abre a sessão. Ela abre quando o mestre está online e pelo menos a metade dos jogadores também (ou no horário marcado).${crowd} As rolagens só contam pras conquistas com a sessão aberta.`}>
      Sessão fechada
      {why && <small>{why}</small>}
      {s.nextAt && <small>próxima: {formatStart(s.nextAt)}</small>}
    </span>
  )
}
