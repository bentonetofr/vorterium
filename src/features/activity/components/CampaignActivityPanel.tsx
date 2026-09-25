import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ACTIVITY_PAGE_SIZE,
  getCampaignActivity,
  getCampaignPresence,
  isUserOnline,
  formatActivityTime,
  formatPresenceTime,
  subscribeToCampaignActivity,
  ACTIVITY_ICONS,
} from '../services/activityService'
import { getCampaignMembers } from '../../members/services/memberService'
import { changeRank, describeChange, type RawSheetChange, type SheetChangeLine } from '../../sheets/altherium/utils/altheriumActivity'
import { Select } from '../../../shared/components/Select'
import type { CampaignActivity, CampaignMemberWithProfile, CampaignPresenceRecord } from '../../../shared/types'
import './CampaignActivityPanel.css'

// ────────────────────────────────────────────────────────
// Aba Atividade. O mestre vê também as mudanças detalhadas das fichas
// Altherium ("sheet_changed", registradas pelo banco e escondidas do
// jogador pela RLS), com filtro por tipo e por jogador. Chega tudo ao
// vivo pelo Realtime.
// ────────────────────────────────────────────────────────

interface CampaignActivityPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

interface MemberPresence {
  member:      CampaignMemberWithProfile
  lastSeenAt:  string | undefined
  online:      boolean
}

type Category = 'todas' | 'fichas' | 'dados' | 'triunfos' | 'campanha'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'todas',    label: 'Tudo' },
  { id: 'fichas',   label: 'Fichas' },
  { id: 'dados',    label: 'Dados' },
  { id: 'triunfos', label: 'Triunfos' },
  { id: 'campanha', label: 'Campanha' },
]

function categoryOf(type: string): Exclude<Category, 'todas'> {
  if (type === 'sheet_changed' || type === 'sheet_updated') return 'fichas'
  if (type === 'dice_rolled') return 'dados'
  if (type === 'triumph_used') return 'triunfos'
  return 'campanha'
}

interface SheetChangeMeta {
  sheet_id:       string
  owner_id:       string
  character_name: string | null
  first_at?:      string
  changes:        RawSheetChange[]
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Hoje'
  if (same(d, yesterday)) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function sortDesc(list: CampaignActivity[]): CampaignActivity[] {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function CampaignActivityPanel({ campaignId, userRole }: CampaignActivityPanelProps) {
  const isMaster = userRole === 'master'
  const [activities,   setActivities]   = useState<CampaignActivity[]>([])
  const [presenceList, setPresenceList] = useState<MemberPresence[]>([])
  const [members,      setMembers]      = useState<CampaignMemberWithProfile[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [refreshing,   setRefreshing]   = useState(false)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(false)
  const [category,     setCategory]     = useState<Category>('todas')
  const [player,       setPlayer]       = useState('')

  const load = useCallback(async () => {
    try {
      const [acts, memberList, presence] = await Promise.all([
        getCampaignActivity(campaignId),
        getCampaignMembers(campaignId),
        getCampaignPresence(campaignId),
      ])

      const presenceMap = new Map<string, string>(
        presence.map((p: CampaignPresenceRecord) => [p.user_id, p.last_seen_at])
      )

      const merged: MemberPresence[] = memberList.map((m) => {
        const lastSeenAt = presenceMap.get(m.user_id)
        return { member: m, lastSeenAt, online: isUserOnline(lastSeenAt) }
      })

      merged.sort((a, b) => {
        if (a.online && !b.online) return -1
        if (!a.online && b.online) return 1
        if (a.lastSeenAt && b.lastSeenAt) {
          return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
        }
        if (a.lastSeenAt) return -1
        if (b.lastSeenAt) return 1
        return 0
      })

      setActivities(acts)
      setHasMore(acts.length >= ACTIVITY_PAGE_SIZE)
      setMembers(memberList)
      setPresenceList(merged)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a atividade.')
    }
  }, [campaignId])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  // Ao vivo: entrada nova entra no topo; entrada de ficha que continua
  // sendo mexida é trocada no lugar; entrada que se desfez some.
  useEffect(() => subscribeToCampaignActivity(campaignId, {
    onUpsert: (row) => setActivities((prev) => sortDesc([row, ...prev.filter((a) => a.id !== row.id)])),
    onDelete: (id) => setActivities((prev) => prev.filter((a) => a.id !== id)),
  }), [campaignId])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function handleLoadMore() {
    const oldest = activities[activities.length - 1]
    if (!oldest) return
    setLoadingMore(true)
    try {
      const older = await getCampaignActivity(campaignId, { before: oldest.created_at })
      setActivities((prev) => sortDesc([...prev, ...older.filter((o) => !prev.some((p) => p.id === o.id))]))
      setHasMore(older.length >= ACTIVITY_PAGE_SIZE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar mais.')
    } finally {
      setLoadingMore(false)
    }
  }

  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.user_id, m.profile.display_name]))
    return (id: string | null | undefined) => (id ? map.get(id) ?? 'Membro removido' : 'Alguém')
  }, [members])
  const masterId = members.find((m) => m.role === 'master')?.user_id ?? null

  const visible = activities.filter((a) => {
    if (category !== 'todas' && categoryOf(a.type) !== category) return false
    if (player) {
      const owner = (a.metadata as Partial<SheetChangeMeta> | null)?.owner_id
      if (a.actor_id !== player && owner !== player) return false
    }
    return true
  })

  // Separadores de dia.
  const groups: { day: string; items: CampaignActivity[] }[] = []
  for (const item of visible) {
    const day = dayLabel(item.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }

  const onlineCount = presenceList.filter((p) => p.online).length
  const playerOptions = [
    { value: '', label: 'Todos os membros' },
    ...members.map((m) => ({ value: m.user_id, label: `${m.profile.display_name}${m.role === 'master' ? ' (mestre)' : ''}` })),
  ]

  return (
    <section className="act-panel">

      {/* ── Cabeçalho ── */}
      <header className="act-panel__header">
        <div className="act-panel__header-left">
          <span className="act-panel__icon" aria-hidden="true">◉</span>
          <h3 className="act-panel__title">Atividade</h3>
          {!loading && (
            <span className="act-panel__subtitle">
              {isMaster ? 'Tudo o que acontece na campanha, com as mudanças de cada ficha' : 'Últimas ações da campanha'}
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost act-panel__refresh"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          aria-label="Atualizar atividade"
        >
          <span className={refreshing ? 'act-panel__refresh-icon--spin' : 'act-panel__refresh-icon'}>
            ↺
          </span>
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      {loading ? (
        <div className="act-state">
          <div className="spinner spinner--sm" />
          <span>Carregando atividade...</span>
        </div>
      ) : error ? (
        <div className="act-state act-state--error" role="alert">{error}</div>
      ) : (
        <div className="act-layout">

          {/* ── Feed ── */}
          <div className="act-feed-card">
            <div className="act-filters">
              <div className="act-filters__chips" role="radiogroup" aria-label="Tipo de atividade">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id} type="button" role="radio" aria-checked={category === c.id}
                    className={`act-filter${category === c.id ? ' act-filter--active' : ''}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {isMaster && members.length > 1 && (
                <Select
                  className="act-filters__player" value={player} onChange={setPlayer}
                  options={playerOptions} aria-label="Filtrar por membro"
                />
              )}
            </div>

            {groups.length > 0 ? (
              <div className="act-days">
                {groups.map((g) => (
                  <div key={g.day} className="act-day">
                    <h5 className="act-day__label">{g.day}</h5>
                    <ul className="act-feed" role="list">
                      {g.items.map((item) => (
                        <li key={item.id} className={`act-item${item.type === 'sheet_changed' ? ' act-item--sheet' : ''}`}>
                          <span className="act-item__icon" aria-hidden="true">
                            {ACTIVITY_ICONS[item.type] ?? '◦'}
                          </span>
                          <div className="act-item__body">
                            {item.type === 'sheet_changed' && item.metadata
                              ? <SheetChangeEntry meta={item.metadata as unknown as SheetChangeMeta} actorId={item.actor_id} masterId={masterId} nameOf={nameOf} />
                              : <span className="act-item__message">{item.message}</span>}
                            <time className="act-item__time" dateTime={item.created_at} title={new Date(item.created_at).toLocaleString('pt-BR')}>
                              {clockTime(item.created_at)} · {formatActivityTime(item.created_at)}
                            </time>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="act-feed__empty">
                {activities.length === 0 ? 'Nenhuma atividade registrada ainda.' : 'Nada com esse filtro nas atividades carregadas.'}
              </p>
            )}

            {hasMore && (
              <button type="button" className="btn btn-ghost act-more" onClick={() => void handleLoadMore()} disabled={loadingMore}>
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </button>
            )}
          </div>

          {/* ── Presença online ── */}
          <div className="act-presence-card">
            <h4 className="act-card__title">
              Membros
              {onlineCount > 0 && (
                <span className="act-presence__online-badge">{onlineCount} online</span>
              )}
            </h4>

            {presenceList.length > 0 ? (
              <ul className="act-presence-list anim-stagger" role="list">
                {presenceList.map(({ member, lastSeenAt, online }) => (
                  <li key={member.user_id} className="presence-item">
                    <span
                      className={`presence-dot ${online ? 'presence-dot--online' : 'presence-dot--offline'}`}
                      aria-label={online ? 'online' : 'offline'}
                    />
                    <div className="presence-item__body">
                      <span className="presence-item__name">
                        {member.profile.display_name}
                        {member.role === 'master' && (
                          <span className="presence-item__role"> (mestre)</span>
                        )}
                      </span>
                      {!online && (
                        <span className="presence-item__time">
                          {formatPresenceTime(lastSeenAt)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="act-feed__empty">Sem membros.</p>
            )}
          </div>

        </div>
      )}
    </section>
  )
}

// ── Entrada de mudança de ficha ─────────────────────────

interface SheetChangeEntryProps {
  meta:     SheetChangeMeta
  actorId:  string | null
  masterId: string | null
  nameOf:   (id: string | null | undefined) => string
}

function SheetChangeEntry({ meta, actorId, masterId, nameOf }: SheetChangeEntryProps) {
  const lines = [...(meta.changes ?? [])]
    .sort((a, b) => changeRank(a) - changeRank(b))
    .flatMap(describeChange)
  const character = meta.character_name?.trim() || 'Personagem sem nome'
  const owner = nameOf(meta.owner_id)
  const byOther = actorId && actorId !== meta.owner_id
  const editor = actorId === masterId ? 'o mestre' : nameOf(actorId)

  return (
    <div className="act-sheet">
      <span className="act-item__message">
        <strong>{character}</strong>
        <span className="act-sheet__owner"> · ficha de {owner}</span>
        {byOther && <span className="act-sheet__editor"> · editada por {editor}</span>}
      </span>
      <ul className="act-changes">
        {lines.map((line) => <ChangeLine key={line.key} line={line} />)}
      </ul>
    </div>
  )
}

function ChangeLine({ line }: { line: SheetChangeLine }) {
  return (
    <li className={`act-change act-change--${line.tone}`}>
      <span className="act-change__label">{line.label}</span>
      {line.from !== undefined && line.to !== undefined && (
        <span className="act-change__values">
          <span className="act-change__from">{line.from}</span>
          <span className="act-change__arrow" aria-label="para">→</span>
          <span className="act-change__to">{line.to}</span>
        </span>
      )}
      {line.delta != null && line.delta !== 0 && (
        <span className="act-change__delta">{line.delta > 0 ? `+${line.delta}` : `−${Math.abs(line.delta)}`}</span>
      )}
      {line.note && <span className="act-change__note">{line.note}</span>}
      {line.details && line.details.length > 0 && (
        <ul className="act-change__details">
          {line.details.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}
      {line.long && (
        <details className="act-change__long">
          <summary>Ver antes e depois</summary>
          <div className="act-change__long-grid">
            <div><span>Antes</span><p>{line.long.from || '(vazio)'}</p></div>
            <div><span>Depois</span><p>{line.long.to || '(vazio)'}</p></div>
          </div>
        </details>
      )}
    </li>
  )
}
