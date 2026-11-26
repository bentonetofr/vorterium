import { useState } from 'react'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../../shared/components/TabIndicator'
import { armorScore, currentClass, evasion, hopeSlots, hpSlots, stressSlots } from '../model/derive'
import type { DhSheetData } from '../model/types'
import type { DhSheet as DhSheetRecord } from '../services/dhSheetService'
import { useDhSheet } from '../services/useDhSheet'
import { DhCardsTab } from './DhCardsTab'
import { DhQuickForm } from './DhQuickForm'
import { DhStartChoice } from './DhStartChoice'
import { DhExtraTab, hasBeastform, hasCompanion } from './DhExtraTab'
import { DhLevelTab } from './DhLevelTab'
import { DhPersonTab, Notes } from './DhPersonTab'
import { DhRestTab } from './DhRestTab'
import { DhSheetMain } from './DhSheetMain'

// ────────────────────────────────────────────────────────
// A ficha aberta: sem classe ainda, o assistente de criação; com ela, as abas (Ficha no desenho do livro, Cartas,
// Subir de nível, Personagem, Descanso, Extras da classe e Anotações). Tudo salva sozinho.
// ────────────────────────────────────────────────────────

interface Props {
  sheet: DhSheetRecord
  canEdit: boolean
  playerName?: string
}

type Tab = 'ficha' | 'cartas' | 'nivel' | 'personagem' | 'descanso' | 'extras' | 'notas'

export function DhSheet({ sheet, canEdit, playerName }: Props) {
  const { data, update, status, error } = useDhSheet(sheet)
  const [tab, setTab] = useState<Tab>('ficha')
  const [quick, setQuick] = useState(false)
  const started = data.started || !!data.classKey
  /** Quem abre a ficha em branco escolhe como montar; o mestre olhando a ficha de um jogador não. */
  const mine = canEdit && (!playerName || playerName === 'NPC')
  const extras = hasBeastform(data) || hasCompanion(data)
  const tabs: { id: Tab; label: string }[] = [
    { id: 'ficha', label: 'Ficha' },
    { id: 'cartas', label: 'Cartas' },
    { id: 'nivel', label: 'Subir de nível' },
    { id: 'personagem', label: 'Personagem' },
    { id: 'descanso', label: 'Descanso' },
    ...(extras ? [{ id: 'extras' as Tab, label: hasBeastform(data) ? 'Forma de Fera' : 'Companheiro' }] : []),
    { id: 'notas', label: 'Anotações' },
  ]
  const ids = tabs.map((t) => t.id)
  const tabDir = useTabDirection(ids, tab)
  const { tabsRef, selectTab, panelsStyle } = useStableTabPanels(setTab)
  const target = { campaignId: sheet.campaign_id, sheetId: sheet.id, character: data.name.trim() || currentClass(data)?.name || 'Personagem' }

  if (!started) {
    if (!mine) return <p className="sheet-empty">{playerName ?? 'O jogador'} ainda não montou o personagem.</p>
    return (
      <>
        <p className="sheet-empty">Escolha como montar a ficha.</p>
        {!quick && <DhStartChoice onManual={() => update((d) => ({ ...d, started: true }))} onQuick={() => setQuick(true)} />}
        {quick && <DhQuickForm onCancel={() => setQuick(false)} onDone={(d: DhSheetData) => { update(() => d); setQuick(false) }} />}
      </>
    )
  }

  return (
    <div className="dh-sheet" data-tabdir={tabDir}>
      <div className="dh-status" aria-live="polite">
        {playerName && <span>Ficha de {playerName}</span>}
        <span className={`dh-status__dot dh-status__dot--${status}`}>{status === 'salvando' ? 'Salvando…' : status === 'erro' ? 'Erro ao salvar' : 'Salvo'}</span>
      </div>
      {error && <p className="sheet-feedback sheet-feedback--error" role="alert">{error}</p>}

      <div className="dh-hud" aria-label="Resumo do personagem">
        <span><i>Vida</i><b className={data.hpMarked >= hpSlots(data) ? 'is-bad' : ''}>{hpSlots(data) - data.hpMarked}<small>/{hpSlots(data)}</small></b></span>
        <span><i>Fadiga</i><b className={data.stressMarked >= stressSlots(data) ? 'is-bad' : ''}>{stressSlots(data) - data.stressMarked}<small>/{stressSlots(data)}</small></b></span>
        <span><i>Esperança</i><b>{data.hope}<small>/{hopeSlots(data)}</small></b></span>
        <span><i>Armadura</i><b>{Math.max(0, armorScore(data) - data.armorMarked)}<small>/{armorScore(data)}</small></b></span>
        <span><i>Evasão</i><b>{evasion(data)}</b></span>
      </div>

      <nav ref={tabsRef} className="campaign-tabs dh-tabs" role="tablist" aria-label="Seções da ficha">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`campaign-tab ${tab === t.id ? 'campaign-tab--active' : ''}`} onClick={() => selectTab(t.id)}>
            <span className="campaign-tab__label">{t.label}</span>
          </button>
        ))}
        <TabIndicator activeKey={tab} />
      </nav>

      <div style={panelsStyle}>
        {tab === 'ficha' && <div className="anim-tab-panel"><DhSheetMain data={data} update={update} target={target} canEdit={canEdit} /></div>}
        {tab === 'cartas' && <div className="anim-tab-panel"><DhCardsTab data={data} update={update} canEdit={canEdit} /></div>}
        {tab === 'nivel' && <div className="anim-tab-panel"><DhLevelTab data={data} update={update} canEdit={canEdit} /></div>}
        {tab === 'personagem' && <div className="anim-tab-panel"><DhPersonTab data={data} update={update} canEdit={canEdit} /></div>}
        {tab === 'descanso' && <div className="anim-tab-panel"><DhRestTab data={data} update={update} canEdit={canEdit} /></div>}
        {tab === 'extras' && <div className="anim-tab-panel"><DhExtraTab data={data} update={update} canEdit={canEdit} /></div>}
        {tab === 'notas' && <div className="anim-tab-panel"><Notes data={data} update={update} canEdit={canEdit} /></div>}
      </div>
    </div>
  )
}
