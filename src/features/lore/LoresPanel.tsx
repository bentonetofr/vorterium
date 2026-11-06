import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCampaignAltheriumSheets } from '../sheets/altherium/services/altheriumSheetService'
import { getCampaignDndSheets } from '../sheets/dnd/services/dndSheetService'
import { Presence } from '../../shared/components/Presence'
import type { CampaignWithRole } from '../../shared/types'
import { countWords, relativeTime } from './lorePure'
import {
  listCampaignLores, subscribeToCampaignLores,
  type CharacterLore, type CharacterLoreFile, type LoreSystem,
} from './loreService'
import { LoreFileCard, LoreViewer } from './LoreFiles'
import './Lore.css'

// ────────────────────────────────────────────────────────
// Aba "Lores" da Sessão (só o mestre): todas as lores da campanha num lugar
// só, uma por jogador. Lista à esquerda (com busca e o aviso de "novo"),
// leitura à direita. Atualiza na hora quando alguém escreve.
// ────────────────────────────────────────────────────────

interface Entry {
  sheetId:   string
  name:      string
  player:    string
  portrait:  string | null
  lore:      CharacterLore | null
  files:     CharacterLoreFile[]
  /** Última mudança (texto ou arquivo), ou null se não há nada. */
  latest:    string | null
  words:     number
}

function latestOf(lore: CharacterLore | null, files: CharacterLoreFile[]): string | null {
  const dates = [lore && lore.body.trim() ? lore.updated_at : null, ...files.map((f) => f.created_at)].filter((d): d is string => !!d)
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
}

const seenKey = (campaignId: string) => `vorterium:lore-seen:${campaignId}`
function readSeen(campaignId: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(seenKey(campaignId)) ?? '{}') as Record<string, string> } catch { return {} }
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
}

function Avatar({ name, src, big = false }: { name: string; src: string | null; big?: boolean }) {
  return (
    <span className={`lore-avatar${big ? ' lore-avatar--big' : ''}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  )
}

export function LoresPanel({ campaign }: { campaign: CampaignWithRole }) {
  const system = campaign.system as LoreSystem
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState(false)
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen(campaign.id))
  const [opened, setOpened] = useState<CharacterLoreFile | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const [sheets, { lores, files }] = await Promise.all([
        system === 'altherium'
          ? getCampaignAltheriumSheets(campaign.id).then((list) => list.map((s) => ({
              id: s.id, name: s.character_name ?? '', player: s.profile?.display_name ?? '', portrait: s.portrait_url ?? null,
            })))
          : getCampaignDndSheets(campaign.id).then((list) => list.map((s) => ({
              id: s.id, name: s.character_name ?? '', player: s.profile?.display_name ?? s.player_name ?? '', portrait: s.portrait_url ?? null,
            }))),
        listCampaignLores(campaign.id),
      ])
      setEntries(sheets.map((s) => {
        const lore = lores.find((l) => l.sheet_id === s.id) ?? null
        const own = files.filter((f) => f.sheet_id === s.id)
        return {
          sheetId: s.id, name: s.name.trim() || 'Sem nome', player: s.player.trim() || 'Jogador',
          portrait: s.portrait, lore, files: own, latest: latestOf(lore, own), words: countWords(lore?.body ?? ''),
        }
      }))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as lores.')
    } finally {
      setLoading(false)
    }
  }, [campaign.id, system])

  useEffect(() => { setLoading(true); void load() }, [load])

  // Tempo real: recarrega (com um respiro) quando alguém escreve ou envia arquivo.
  useEffect(() => {
    let t: number | undefined
    const off = subscribeToCampaignLores(campaign.id, () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => { void load() }, 400)
    })
    return () => { window.clearTimeout(t); off() }
  }, [campaign.id, load])

  const isNew = useCallback(
    (e: Entry) => e.latest !== null && (seen[e.sheetId] ?? '') < e.latest,
    [seen],
  )

  const q = query.trim().toLowerCase()
  const sorted = useMemo(() => {
    const match = (e: Entry) => !q
      || e.name.toLowerCase().includes(q) || e.player.toLowerCase().includes(q)
      || (e.lore?.body.toLowerCase().includes(q) ?? false) || e.files.some((f) => f.name.toLowerCase().includes(q))
    // Mais recentes primeiro. A ordem não depende de "lida/não lida": a lista não pula enquanto o mestre lê.
    return entries.filter(match).sort((a, b) => {
      if (a.latest && b.latest) return a.latest < b.latest ? 1 : -1
      if (a.latest) return -1
      if (b.latest) return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [entries, q])

  const selected = entries.find((e) => e.sheetId === selectedId) ?? null

  function markSeen(e: Entry) {
    if (!e.latest) return
    const next = { ...seen, [e.sheetId]: e.latest }
    setSeen(next)
    try { localStorage.setItem(seenKey(campaign.id), JSON.stringify(next)) } catch { /* sem armazenamento: só não lembra */ }
  }

  function select(e: Entry) {
    setSelectedId(e.sheetId)
    setDetail(true)
    setCopied(false)
    markSeen(e)
  }

  // Abre sozinho a primeira lore com novidade (ou a primeira da lista).
  useEffect(() => {
    if (!selectedId && sorted.length > 0 && window.matchMedia('(min-width: 761px)').matches) select(sorted[0]!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.length])

  // Se a lore aberta ganhou novidade enquanto o mestre lê, já conta como lida.
  useEffect(() => {
    if (detail && selected && selected.latest && (seen[selected.sheetId] ?? '') < selected.latest) markSeen(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.latest])

  const written = entries.filter((e) => e.latest !== null).length
  const newCount = entries.filter(isNew).length

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { /* sem permissão */ }
  }

  if (loading) return <div className="lores"><div className="lore__loading"><span className="spinner" /> Reunindo as lores…</div></div>
  if (error) return <div className="lores"><p className="lore__error" role="alert">{error}</p></div>

  return (
    <div className={`lores${campaign.system === 'altherium' ? ' lore--quill' : ''}`} data-view={detail ? 'detail' : 'list'}>
      <aside className="lores__list" aria-label="Lores dos jogadores">
        <div className="lores__summary">
          <strong>{written} de {entries.length}</strong>
          <span>{entries.length === 1 ? 'personagem tem' : 'personagens têm'} lore</span>
          {newCount > 0 && <em className="lores__news">{newCount} {newCount === 1 ? 'novidade' : 'novidades'}</em>}
        </div>
        <input
          type="search" className="input lores__search" placeholder="Buscar por nome, texto ou arquivo…"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar nas lores"
        />
        <ul className="lores__items">
          {sorted.map((e) => {
            const fresh = isNew(e)
            const snippet = e.lore?.body.trim().replace(/\s+/g, ' ').slice(0, 90)
            return (
              <li key={e.sheetId}>
                <button type="button" className={`lores-item${selectedId === e.sheetId ? ' is-on' : ''}${e.latest ? '' : ' is-empty'}`} onClick={() => select(e)}>
                  <Avatar name={e.name} src={e.portrait} />
                  <span className="lores-item__text">
                    <strong>{e.name}{fresh && <i className="lores-item__dot" aria-label="novidade" />}</strong>
                    <small>{e.player}</small>
                    <span className="lores-item__snippet">{snippet ? `${snippet}${(e.lore?.body.length ?? 0) > 90 ? '…' : ''}` : e.latest ? 'Só arquivos.' : 'Ainda sem lore.'}</span>
                    {e.latest && (
                      <span className="lores-item__meta">
                        {e.words > 0 && <span>{e.words} palavras</span>}
                        {e.files.length > 0 && <span>{e.files.length} {e.files.length === 1 ? 'arquivo' : 'arquivos'}</span>}
                        <span>{relativeTime(e.latest)}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
          {sorted.length === 0 && <li className="lore__empty">{entries.length === 0 ? 'Nenhuma ficha de jogador nesta campanha ainda.' : 'Nada encontrado.'}</li>}
        </ul>
      </aside>

      <section className="lores__read" aria-live="polite">
        {!selected ? (
          <div className="lores__placeholder">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M8 7h8M8 11h6" /></svg>
            <p>Escolha um personagem para ler a lore.</p>
          </div>
        ) : (
          <div className="lores-doc" key={selected.sheetId}>
            <button type="button" className="lore-btn lores-doc__back" onClick={() => setDetail(false)}>← Todas as lores</button>
            <header className="lores-doc__head">
              <Avatar name={selected.name} src={selected.portrait} big />
              <div>
                <h3 className="lores-doc__name">{selected.name}</h3>
                <p className="lores-doc__player">de {selected.player}{selected.latest ? ` · atualizada ${relativeTime(selected.latest)}` : ''}</p>
              </div>
              {selected.lore?.body.trim() && (
                <button type="button" className="lore-btn lores-doc__copy" onClick={() => void copy(selected.lore!.body)}>{copied ? '✓ Copiado' : 'Copiar texto'}</button>
              )}
            </header>

            {!selected.latest && (
              <p className="lore__empty lores-doc__none">{selected.player} ainda não escreveu nem enviou a lore de {selected.name}.</p>
            )}

            {selected.lore?.body.trim() && (
              <article className="lores-read">
                {selected.lore.body.trim().split(/\n{2,}/).map((para, i) => (
                  <p key={i} className={i === 0 ? 'lores-read__first' : undefined}>{para}</p>
                ))}
              </article>
            )}

            {selected.files.length > 0 && (
              <div className="lores-doc__files">
                <h4 className="lores-doc__sub">Arquivos <span className="lore-card__count">{selected.files.length}</span></h4>
                <ul className="lore-files lore-files--grid">
                  {selected.files.map((f) => <LoreFileCard key={f.id} file={f} onOpen={setOpened} />)}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <Presence show={opened !== null} exitMs={220}>
        {() => opened && <LoreViewer file={opened} onClose={() => setOpened(null)} />}
      </Presence>
    </div>
  )
}
