import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { getCampaignMembers } from '../members/services/memberService'
import { getCampaignRolls } from '../dice/services/diceService'
import { clearNudge, listNudges, setNudge, type Nudge, type NudgeMode } from './rollNudge'
import { summarizePlayers, type PlayerStats, type StatRoll } from './playerStats'

// ────────────────────────────────────────────────────────
// Aba Jogadores do painel do dono: os dados de cada jogador da campanha aberta (rolagens, d20, críticos, falhas e as últimas
// rolagens). Só leitura, e só pra conta do dono (o painel inteiro some pras outras).
// ────────────────────────────────────────────────────────

const ROLL_LIMIT = 500

const fmt = (n: number | null, digits = 1) => (n == null ? '–' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }))

function ago(iso: string | null): string {
  if (!iso) return 'nunca rolou'
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

export function OwnerPlayersTab() {
  const { campaign } = useCurrentCampaign()
  const campaignId = campaign?.id ?? null
  const [rolls, setRolls] = useState<StatRoll[] | null>(null)
  const [members, setMembers] = useState<{ userId: string; name: string; role: 'master' | 'player' }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const myId = useAuth().user?.id

  const load = useCallback(async () => {
    if (!campaignId) return
    setBusy(true); setError(null)
    try {
      const [mem, rows] = await Promise.all([getCampaignMembers(campaignId), getCampaignRolls(campaignId, ROLL_LIMIT)])
      // sem a migration dos ajustes a lista de jogadores continua funcionando
      setNudges(await listNudges(campaignId).catch(() => []))
      setMembers(mem.map((m) => ({ userId: m.user_id, name: m.profile.display_name || 'Sem nome', role: m.role })))
      setRolls(rows as unknown as StatRoll[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu pra carregar.')
    } finally {
      setBusy(false)
    }
  }, [campaignId])

  // lê de novo ao abrir a aba e quando a campanha muda
  useEffect(() => { setRolls(null); void load() }, [load])

  const players = useMemo(() => (rolls ? summarizePlayers(rolls, members) : []), [rolls, members])

  if (!campaignId) return <p className="owner-panel__empty">Abra uma campanha pra ver os jogadores dela.</p>

  return (
    <div className="owner-players">
      <div className="owner-players__bar">
        <span className="owner-panel__h">{campaign?.name}</span>
        <button type="button" className="owner-panel__ghost" onClick={() => void load()} disabled={busy}>{busy ? 'Lendo…' : 'Atualizar'}</button>
      </div>
      {error && <p className="owner-panel__empty owner-panel__empty--err" role="alert">{error}</p>}
      {!rolls && !error && <p className="owner-panel__empty">Lendo as rolagens…</p>}
      {rolls && (
        <PlayersList
          players={players} read={rolls.length} nudges={nudges} selfId={myId}
          onNudge={async (n) => { setError(null); try { await setNudge({ ...n, campaign_id: campaignId }); setNudges(await listNudges(campaignId)) } catch (e) { setError(e instanceof Error ? e.message : 'Não deu pra gravar.') } }}
          onClear={async (userId) => { setError(null); try { await clearNudge(campaignId, userId); setNudges(await listNudges(campaignId)) } catch (e) { setError(e instanceof Error ? e.message : 'Não deu pra cancelar.') } }}
        />
      )}
    </div>
  )
}

/** A lista (só desenho: a página de teste usa com dados de mentira). */
export interface PlayersListProps {
  players: PlayerStats[]
  read: number
  nudges?: Nudge[]
  /** A conta do dono (não ajusta o próprio dado por aqui: pra isso tem a aba Dados). */
  selfId?: string
  onNudge?: (n: Omit<Nudge, 'campaign_id'>) => void | Promise<void>
  onClear?: (userId: string) => void | Promise<void>
}

export function PlayersList({ players, read, nudges = [], selfId, onNudge, onClear }: PlayersListProps) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <p className="owner-players__note">Das últimas {ROLL_LIMIT} rolagens da campanha ({read} lidas). Rolagem privada de outro jogador só aparece onde você é o mestre.</p>
      <ul className="owner-players__list">
        {players.map((p) => (
          <PlayerRow
            key={p.userId} p={p} expanded={open === p.userId} onToggle={() => setOpen(open === p.userId ? null : p.userId)}
            nudge={nudges.find((n) => n.target_user_id === p.userId)} canNudge={!!onNudge && p.userId !== selfId} onNudge={onNudge} onClear={onClear}
          />
        ))}
      </ul>
    </>
  )
}

interface RowProps {
  p: PlayerStats; expanded: boolean; onToggle: () => void
  nudge?: Nudge; canNudge: boolean
  onNudge?: PlayersListProps['onNudge']; onClear?: PlayersListProps['onClear']
}

function PlayerRow({ p, expanded, onToggle, nudge, canNudge, onNudge, onClear }: RowProps) {
  return (
    <li className={`owner-player${expanded ? ' owner-player--open' : ''}`}>
      <button type="button" className="owner-player__head" onClick={onToggle} aria-expanded={expanded}>
        <span className="owner-player__avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
        <span className="owner-player__who">
          <span className="owner-player__name">{p.name}{p.role === 'master' && <em className="owner-player__tag">mestre</em>}</span>
          <span className="owner-player__last">{p.rolls} {p.rolls === 1 ? 'rolagem' : 'rolagens'} · {ago(p.lastAt)}</span>
        </span>
        {nudge && <span className="owner-player__armed" title="Próximo dado ajustado">{nudgeLabel(nudge)}</span>}
        <span className="owner-player__chev" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
      </button>
      <dl className="owner-player__stats">
        <div><dt>d20</dt><dd>{p.d20}</dd></div>
        <div title="Média dos d20 (um dado justo dá 10,5)"><dt>Média</dt><dd>{fmt(p.d20Avg)}</dd></div>
        <div><dt>Crít.</dt><dd className={p.strong ? 'is-good' : ''}>{p.strong}</dd></div>
        <div><dt>Falhas</dt><dd className={p.weak ? 'is-bad' : ''}>{p.weak}</dd></div>
      </dl>
      {expanded && (
        <div className="owner-player__more">
          {canNudge && onNudge && onClear && <NudgeControls nudge={nudge} onNudge={(n) => onNudge({ ...n, target_user_id: p.userId })} onClear={() => onClear(p.userId)} />}
          <p className="owner-player__sum">
            Maior d20 <b>{fmt(p.d20Max, 0)}</b> · menor <b>{fmt(p.d20Min, 0)}</b> · testes: <b className="is-good">{p.successes}</b> com sucesso, <b className="is-bad">{p.failures}</b> com falha
          </p>
          {p.recent.length === 0
            ? <p className="owner-panel__empty">Ainda sem rolagens.</p>
            : (
              <ol className="owner-player__rolls">
                {p.recent.map((r) => (
                  <li key={r.id}>
                    <span className="owner-player__what">{r.roll_label || r.formula || r.die_type}{r.is_private && <em className="owner-player__tag">privada</em>}</span>
                    <span className="owner-player__res">{r.result}</span>
                    <span className="owner-player__when">{ago(r.created_at)}</span>
                  </li>
                ))}
              </ol>
            )}
        </div>
      )}
    </li>
  )
}

const MODE_LABEL: Record<NudgeMode, string> = { max: 'Máximo', min: 'Mínimo', fixed: 'Número' }
const nudgeLabel = (n: Pick<Nudge, 'mode' | 'fixed' | 'd20_only'>) => `${n.mode === 'fixed' ? `Cai ${n.fixed}` : MODE_LABEL[n.mode]}${n.d20_only ? ' · d20' : ''}`

/** O ajuste do PRÓXIMO dado deste jogador: escolhe o que cai e aplica; vale uma vez e some sozinho quando ele rolar. */
function NudgeControls({ nudge, onNudge, onClear }: {
  nudge?: Nudge
  onNudge: (n: Omit<Nudge, 'campaign_id'>) => void | Promise<void>
  onClear: () => void | Promise<void>
}) {
  const [mode, setMode] = useState<NudgeMode>(nudge?.mode ?? 'max')
  const [fixed, setFixed] = useState(nudge?.fixed ?? 20)
  const [d20Only, setD20Only] = useState(nudge?.d20_only ?? false)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => void | Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  return (
    <div className="owner-nudge">
      <div className="owner-nudge__head">
        <span className="owner-panel__h">Próximo dado dele</span>
        {nudge && <span className="owner-nudge__now">ajustado: {nudgeLabel(nudge)}</span>}
      </div>
      <div className="owner-nudge__modes" role="radiogroup" aria-label="O que cai no próximo dado">
        {(['max', 'min', 'fixed'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={`owner-panel__mode${mode === m ? ' owner-panel__mode--on' : ''}`} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>
        ))}
        {mode === 'fixed' && (
          <input
            type="number" min={1} max={1000} className="input owner-nudge__num" aria-label="Número que cai" value={fixed}
            onChange={(e) => setFixed(Math.max(1, Math.min(1000, Math.round(Number(e.target.value) || 1))))}
          />
        )}
      </div>
      <label className="owner-panel__check"><input type="checkbox" checked={d20Only} onChange={(e) => setD20Only(e.target.checked)} /><span>Só no d20</span></label>
      <div className="owner-nudge__actions">
        <button type="button" className="owner-nudge__go" disabled={busy} onClick={() => void run(() => onNudge({ target_user_id: '', mode, fixed, d20_only: d20Only }))}>{nudge ? 'Trocar' : 'Ajustar'}</button>
        {nudge && <button type="button" className="owner-panel__ghost" disabled={busy} onClick={() => void run(onClear)}>Cancelar</button>}
      </div>
    </div>
  )
}
