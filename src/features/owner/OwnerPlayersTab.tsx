import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { getCampaignMembers } from '../members/services/memberService'
import { getCampaignRolls } from '../dice/services/diceService'
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

  const load = useCallback(async () => {
    if (!campaignId) return
    setBusy(true); setError(null)
    try {
      const [mem, rows] = await Promise.all([getCampaignMembers(campaignId), getCampaignRolls(campaignId, ROLL_LIMIT)])
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
      {rolls && <PlayersList players={players} read={rolls.length} />}
    </div>
  )
}

/** A lista (só desenho: a página de teste usa com dados de mentira). */
export function PlayersList({ players, read }: { players: PlayerStats[]; read: number }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <p className="owner-players__note">Das últimas {ROLL_LIMIT} rolagens da campanha ({read} lidas). Rolagem privada de outro jogador só aparece onde você é o mestre.</p>
      <ul className="owner-players__list">
        {players.map((p) => <PlayerRow key={p.userId} p={p} expanded={open === p.userId} onToggle={() => setOpen(open === p.userId ? null : p.userId)} />)}
      </ul>
    </>
  )
}

function PlayerRow({ p, expanded, onToggle }: { p: PlayerStats; expanded: boolean; onToggle: () => void }) {
  return (
    <li className={`owner-player${expanded ? ' owner-player--open' : ''}`}>
      <button type="button" className="owner-player__head" onClick={onToggle} aria-expanded={expanded}>
        <span className="owner-player__avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
        <span className="owner-player__who">
          <span className="owner-player__name">{p.name}{p.role === 'master' && <em className="owner-player__tag">mestre</em>}</span>
          <span className="owner-player__last">{p.rolls} {p.rolls === 1 ? 'rolagem' : 'rolagens'} · {ago(p.lastAt)}</span>
        </span>
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
