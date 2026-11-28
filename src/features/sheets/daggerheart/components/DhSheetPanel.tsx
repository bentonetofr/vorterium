import { useCallback, useEffect, useState } from 'react'
import { Loader } from '../../../../shared/components/Loader'
import { useFeature } from '../../../control/siteFeatures'
import { dhClass } from '../catalog/classes'
import { DH_FEATURE } from '../constants/daggerheart'
import { hpSlots, stressSlots } from '../model/derive'
import { normalizeSheet } from '../model/defaults'
import { getCampaignDhSheets, getOrCreateMyDhSheet, subscribeToCampaignDhSheets, type DhSheet as DhSheetRecord, type DhSheetWithProfile } from '../services/dhSheetService'
import { NpcSection } from '../../components/NpcSection'
import { DhGmSection } from './DhGmSection'
import { DhSheet } from './DhSheet'
import { FloatingWindow } from '../../../../shared/components/floating/FloatingWindow'
import { FloatingProvider, useFloatingStore, useOpenIds } from '../../../../shared/components/floating/FloatingProvider'

// ────────────────────────────────────────────────────────
// Aba Ficha das campanhas de DaggerHeart: o jogador edita a sua; o mestre vê as da mesa e abre qualquer uma.
// As fichas dos outros (jogadores, NPCs, adversários e ambientes) abrem em janelas flutuantes que arrastam, recolhem e minimizam,
// em vez de esticar a página; a barra de baixo lista as abertas. A ficha do próprio jogador continua na página.
// ────────────────────────────────────────────────────────

interface Props {
  campaignId: string
  userRole: 'master' | 'player'
}

const WIN = 'dhs:'

export function DhSheetPanel({ campaignId, userRole }: Props) {
  const feature = useFeature(DH_FEATURE)
  return (
    <FloatingProvider scope={campaignId}>
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
        {feature.visible && <DhGmSection campaignId={campaignId} isMaster={userRole === 'master'} />}
        {feature.visible && (
          <NpcSection<DhSheetRecord>
            table="dh_sheets"
            campaignId={campaignId}
            userRole={userRole}
            floating
            summary={(s) => {
              const d = normalizeSheet(s.data)
              const cls = dhClass(d.classKey)
              return {
                badge: `PV ${hpSlots(d) - d.hpMarked}/${hpSlots(d)}`,
                line: cls ? `${cls.name} · Nível ${d.level}` : 'Sem classe',
                bars: <div className="dh-minibars"><span>PV {hpSlots(d) - d.hpMarked}/{hpSlots(d)}</span><span>Fadiga {stressSlots(d) - d.stressMarked}/{stressSlots(d)}</span></div>,
              }
            }}
            renderSheet={(s, { readOnly }) => <DhSheet key={s.id} sheet={{ ...s, data: normalizeSheet(s.data) }} canEdit={!readOnly} playerName="NPC" />}
          />
        )}
      </div>
    </section>
    </FloatingProvider>
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
  const fw = useFloatingStore()
  const openIds = useOpenIds(WIN)

  const load = useCallback(async () => {
    try { setSheets(await getCampaignDhSheets(campaignId)); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar as fichas.') }
  }, [campaignId])
  useEffect(() => { void load(); return subscribeToCampaignDhSheets(campaignId, () => { void load() }) }, [campaignId, load])

  // uma ficha que sumiu leva a janela junto (só depois de carregar, para não fechar o que foi lembrado)
  useEffect(() => {
    if (!sheets) return
    for (const wid of openIds) if (!sheets.some((s) => `${WIN}${s.id}` === wid)) fw.close(wid)
  }, [sheets, openIds, fw])

  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (!sheets) return <div className="sheet-loading"><Loader small /></div>
  if (sheets.length === 0) return <p className="sheet-empty">Nenhum jogador criou ficha de DaggerHeart ainda.</p>

  return (
    <div className="sheets-list-wrapper">
      <div className="sheets-cards anim-stagger">
        {sheets.map((s) => {
          const cls = dhClass(s.data.classKey)
          const hp = hpSlots(s.data)
          const st = stressSlots(s.data)
          return (
            <button key={s.id} type="button" className={`sheet-card ${openIds.includes(`${WIN}${s.id}`) ? 'sheet-card--active' : ''}`} onClick={() => fw.open(`${WIN}${s.id}`)} aria-pressed={openIds.includes(`${WIN}${s.id}`)}>
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
      {openIds.map((wid) => {
        const s = sheets.find((x) => `${WIN}${x.id}` === wid)
        if (!s) return null
        const name = s.data.name || s.profile?.display_name || 'Sem nome'
        const cls = dhClass(s.data.classKey)
        const hp = hpSlots(s.data), st = stressSlots(s.data)
        return (
          <FloatingWindow key={wid} id={wid} title={s.data.name || 'Sem nome'} subtitle={`${cls ? `${cls.name} · Nível ${s.data.level}` : 'Sem classe'}${s.profile?.display_name ? ` · ${s.profile.display_name}` : ''}`}
            avatar={name.charAt(0).toUpperCase()} badge={`PV ${hp - s.data.hpMarked}/${hp}`}
            mini={<div className="dh-minibars"><span>PV {hp - s.data.hpMarked}/{hp}</span><span>Fadiga {st - s.data.stressMarked}/{st}</span><span>Esperança {s.data.hope}</span></div>}>
            <DhSheet key={s.id} sheet={s} canEdit playerName={s.profile?.display_name ?? undefined} />
          </FloatingWindow>
        )
      })}
      {openIds.length === 0 && <p className="sheet-empty sheet-empty--hint">Clique num jogador para abrir a ficha numa janela. Dá para arrastar, recolher e abrir várias ao mesmo tempo.</p>}
    </div>
  )
}
