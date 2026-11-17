import { useCallback, useEffect, useState } from 'react'
import { Loader } from '../../../../shared/components/Loader'
import { useFeature } from '../../../control/siteFeatures'
import { dhClass } from '../catalog/classes'
import { DH_FEATURE } from '../constants/daggerheart'
import { hpSlots, stressSlots } from '../model/derive'
import { normalizeSheet } from '../model/defaults'
import { getCampaignDhSheets, getOrCreateMyDhSheet, subscribeToCampaignDhSheets, type DhSheet as DhSheetRecord, type DhSheetWithProfile } from '../services/dhSheetService'
import { NpcSection } from '../../components/NpcSection'
import { DhSheet } from './DhSheet'

// ────────────────────────────────────────────────────────
// Aba Ficha das campanhas de DaggerHeart: o jogador edita a sua; o mestre vê as da mesa e abre qualquer uma.
// ────────────────────────────────────────────────────────

interface Props {
  campaignId: string
  userRole: 'master' | 'player'
}

export function DhSheetPanel({ campaignId, userRole }: Props) {
  const feature = useFeature(DH_FEATURE)
  return (
    <section className="sheet-panel dh-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">⚄</span>
          <h3 className="sheet-panel__title">Ficha DaggerHeart</h3>
        </div>
      </header>
      <div className="sheet-panel__body">
        {!feature.visible
          ? <p className="sheet-empty">A ficha de DaggerHeart ainda não foi liberada. Volte em breve.</p>
          : userRole === 'player' ? <PlayerView campaignId={campaignId} /> : <MasterView campaignId={campaignId} />}
        {feature.visible && (
          <NpcSection<DhSheetRecord>
            table="dh_sheets"
            campaignId={campaignId}
            userRole={userRole}
            summary={(s) => {
              const d = normalizeSheet(s.data)
              const cls = dhClass(d.classKey)
              return {
                line: cls ? `${cls.name} · Nível ${d.level}` : 'Sem classe',
                bars: <div className="dh-minibars"><span>PV {hpSlots(d) - d.hpMarked}/{hpSlots(d)}</span><span>Fadiga {stressSlots(d) - d.stressMarked}/{stressSlots(d)}</span></div>,
              }
            }}
            renderSheet={(s, { readOnly }) => <DhSheet key={s.id} sheet={{ ...s, data: normalizeSheet(s.data) }} canEdit={!readOnly} playerName="NPC" />}
          />
        )}
      </div>
    </section>
  )
}

function PlayerView({ campaignId }: { campaignId: string }) {
  const [sheet, setSheet] = useState<DhSheetRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setSheet(null)
    getOrCreateMyDhSheet(campaignId)
      .then((s) => { if (alive) { setSheet(s); setError(null) } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Não foi possível carregar a ficha.') })
    return () => { alive = false }
  }, [campaignId])
  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (!sheet) return <div className="sheet-loading"><Loader small /></div>
  return <DhSheet key={sheet.id} sheet={sheet} canEdit />
}

function MasterView({ campaignId }: { campaignId: string }) {
  const [sheets, setSheets] = useState<DhSheetWithProfile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setSheets(await getCampaignDhSheets(campaignId)); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar as fichas.') }
  }, [campaignId])
  useEffect(() => { void load(); return subscribeToCampaignDhSheets(campaignId, () => { void load() }) }, [campaignId, load])

  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (!sheets) return <div className="sheet-loading"><Loader small /></div>
  if (sheets.length === 0) return <p className="sheet-empty">Nenhum jogador criou ficha de DaggerHeart ainda.</p>
  const open = sheets.find((s) => s.id === openId) ?? null

  return (
    <div className="sheets-list-wrapper">
      <div className="sheets-cards anim-stagger">
        {sheets.map((s) => {
          const cls = dhClass(s.data.classKey)
          const hp = hpSlots(s.data)
          const st = stressSlots(s.data)
          return (
            <button key={s.id} type="button" className={`sheet-card ${openId === s.id ? 'sheet-card--active' : ''}`} onClick={() => setOpenId(s.id)} aria-pressed={openId === s.id}>
              <div className="sheet-card__top">
                <span className="sheet-card__avatar">{(s.data.name || s.profile?.display_name || '?').charAt(0).toUpperCase()}</span>
                <span className="sheet-card__player">{s.data.name || 'Sem nome'}</span>
              </div>
              <span className="sheet-card__char">{cls ? `${cls.name} · Nível ${s.data.level}` : 'Sem classe'}{s.profile?.display_name ? ` · ${s.profile.display_name}` : ''}</span>
              <div className="dh-minibars"><span>PV {hp - s.data.hpMarked}/{hp}</span><span>Fadiga {st - s.data.stressMarked}/{st}</span><span>Esperança {s.data.hope}</span></div>
            </button>
          )
        })}
      </div>
      {open ? <div className="sheets-list__form"><DhSheet key={open.id} sheet={open} canEdit playerName={open.profile?.display_name ?? undefined} /></div>
        : <p className="sheet-empty sheet-empty--hint">Selecione um jogador acima para ver e editar a ficha.</p>}
    </div>
  )
}
