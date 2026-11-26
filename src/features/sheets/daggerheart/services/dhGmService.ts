import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import { normalizeAdversary, normalizeEnvironment, type DhAdversary, type DhEnvironment, type DhGmKind } from '../model/gm'

// ────────────────────────────────────────────────────────
// Fichas do mestre (dh_gm_sheets, migration 20240240): adversários e ambientes. O mestre cria e edita; os jogadores só leem
// as que ele mostrar (visible). Mesma ideia da ficha de personagem: dados em jsonb e salvamento sozinho.
// ────────────────────────────────────────────────────────

const TABLE = 'dh_gm_sheets'

export interface GmRow<T> {
  id: string
  campaign_id: string
  kind: DhGmKind
  visible: boolean
  data: T
  updated_at: string
}

type Raw = { id: string; campaign_id: string; kind: DhGmKind; visible: boolean; data: unknown; updated_at: string }

function parse(row: Raw): GmRow<DhAdversary | DhEnvironment> {
  return { ...row, data: row.kind === 'adversary' ? normalizeAdversary(row.data) : normalizeEnvironment(row.data) }
}

export async function listGmSheets(campaignId: string): Promise<GmRow<DhAdversary | DhEnvironment>[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true })
  if (error) throw new Error('Não foi possível carregar as fichas do mestre. Confira se a migration de DaggerHeart já rodou.')
  return ((data ?? []) as Raw[]).map(parse)
}

export async function createGmSheet(campaignId: string, kind: DhGmKind, data: DhAdversary | DhEnvironment): Promise<GmRow<DhAdversary | DhEnvironment>> {
  const { data: row, error } = await supabase.from(TABLE).insert({ campaign_id: campaignId, kind, data }).select('*').single()
  if (error) throw new Error('Não foi possível criar a ficha.')
  return parse(row as Raw)
}

export async function saveGmSheet(id: string, data: DhAdversary | DhEnvironment): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ data }).eq('id', id)
  if (error) throw new Error('Não foi possível salvar a ficha.')
}

export async function setGmVisible(id: string, visible: boolean): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ visible }).eq('id', id)
  if (error) throw new Error('Não foi possível mudar quem vê a ficha.')
}

export async function deleteGmSheet(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error('Não foi possível apagar a ficha.')
}

export function subscribeGmSheets(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`dh_gm:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

/** Uma ficha do mestre aberta: salva sozinha 700 ms depois da última mudança (o mestre edita; jogador só lê). */
export function useGmSheet<T extends DhAdversary | DhEnvironment>(id: string, initial: T, canEdit: boolean) {
  const [data, setData] = useState<T>(initial)
  const [status, setStatus] = useState<'ok' | 'salvando' | 'erro'>('ok')
  const dirty = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

  const update = useCallback((fn: (d: T) => T) => {
    if (!canEdit) return
    setData((prev) => { const next = fn(prev); if (next === prev) return prev; dirty.current = true; return next })
  }, [canEdit])

  useEffect(() => {
    if (!dirty.current) return
    setStatus('salvando')
    const t = window.setTimeout(() => {
      const snap = dataRef.current
      saveGmSheet(id, snap).then(() => { if (dataRef.current === snap) dirty.current = false; setStatus(dirty.current ? 'salvando' : 'ok') }).catch(() => setStatus('erro'))
    }, 700)
    return () => window.clearTimeout(t)
  }, [data, id])

  useEffect(() => () => { if (dirty.current) void saveGmSheet(id, dataRef.current).catch(() => {}) }, [id])

  return { data, update, status }
}
