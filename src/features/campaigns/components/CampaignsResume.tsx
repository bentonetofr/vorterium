import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CampaignSession, CampaignWithRole } from '../../../shared/types'
import { readLastCampaign } from '../../../shared/lib/lastCampaign'
import { getUpcomingSessions } from '../../sessions/services/sessionService'
import { countdownLabel, daysUntil, shortDay } from '../../sessions/utils/sessionCountdown'
import { formatRole } from '../../../shared/utils/campaign'
import { CAMPAIGN_SECTIONS } from '../campaignSections'

// ────────────────────────────────────────────────────────
// Topo da página Campanhas: "Continuar de onde parou" (a última campanha
// aberta neste aparelho, com atalho direto pra onde a pessoa estava) e a
// agenda das próximas sessões marcadas, de todas as campanhas.
// ────────────────────────────────────────────────────────

function sectionLabel(section: string): string {
  if (section === 'anotacoes') return 'Anotações dos jogadores'
  return CAMPAIGN_SECTIONS.find((s) => s.id === section)?.label ?? 'Visão geral'
}

interface CampaignsResumeProps {
  userId:    string
  /** Campanhas ativas (não arquivadas) da pessoa. */
  campaigns: CampaignWithRole[]
}

export function CampaignsResume({ userId, campaigns }: CampaignsResumeProps) {
  const [upcoming, setUpcoming] = useState<CampaignSession[]>([])

  const ids = useMemo(() => campaigns.map((c) => c.id), [campaigns])
  const idsKey = ids.join(',')

  useEffect(() => {
    let cancelled = false
    // A agenda é um extra: se a busca falhar, a página segue sem ela.
    getUpcomingSessions(ids).then((list) => { if (!cancelled) setUpcoming(list) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const last = useMemo(() => {
    const saved = readLastCampaign(userId)
    const campaign = saved ? campaigns.find((c) => c.id === saved.campaignId) : undefined
    return saved && campaign ? { campaign, section: saved.section } : null
  }, [userId, campaigns])

  const byId = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns])
  const lastNext = last ? upcoming.find((s) => s.campaign_id === last.campaign.id) : undefined

  if (!last && upcoming.length === 0) return null

  return (
    <div className="resume animate-fade-up">
      {last && (
        <section className="resume-card" aria-label="Continuar de onde parou">
          <div
            className={`resume-card__cover${last.campaign.cover_url ? '' : ' resume-card__cover--empty'}`}
            style={last.campaign.cover_url ? { backgroundImage: `url(${last.campaign.cover_url})` } : undefined}
            aria-hidden="true"
          >
            {!last.campaign.cover_url && '◈'}
          </div>
          <div className="resume-card__body">
            <span className="resume-card__kicker">Continuar de onde parou</span>
            <h3 className="resume-card__name">{last.campaign.name}</h3>
            <p className="resume-card__where">
              Você estava em <strong>{sectionLabel(last.section)}</strong> · {formatRole(last.campaign.role)}
            </p>
            {lastNext && (
              <p className={`resume-card__next${daysUntil(lastNext.session_date) === 0 ? ' resume-card__next--today' : ''}`}>
                <span aria-hidden="true">✦</span> Próxima sessão: {lastNext.title}
                {lastNext.session_date && <> · <strong>{countdownLabel(lastNext.session_date)}</strong> ({shortDay(lastNext.session_date)})</>}
              </p>
            )}
          </div>
          <div className="resume-card__actions">
            <Link to={`/campanhas/${last.campaign.id}/${last.section}`} className="btn btn-primary">Continuar →</Link>
            {last.section !== 'mesa-sessao' && (
              <Link to={`/campanhas/${last.campaign.id}/mesa-sessao`} className="btn btn-ghost">Abrir a sessão</Link>
            )}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="agenda" aria-labelledby="agenda-title">
          <h3 id="agenda-title" className="agenda__title">Próximas sessões</h3>
          <ul className="agenda__list">
            {upcoming.slice(0, 4).map((s) => {
              const days = daysUntil(s.session_date)
              const date = s.session_date ? new Date(`${s.session_date}T12:00:00`) : null
              return (
                <li key={s.id}>
                  <Link to={`/campanhas/${s.campaign_id}/sessoes`} className={`agenda__item${days === 0 ? ' agenda__item--today' : ''}`}>
                    {date && (
                      <span className="agenda__date" aria-hidden="true">
                        <span className="agenda__day">{String(date.getDate()).padStart(2, '0')}</span>
                        <span className="agenda__month">{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                      </span>
                    )}
                    <span className="agenda__text">
                      <span className="agenda__name">{s.title}</span>
                      <span className="agenda__campaign">{byId.get(s.campaign_id)?.name ?? 'Campanha'}</span>
                    </span>
                    <span className="agenda__when">{countdownLabel(s.session_date)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
