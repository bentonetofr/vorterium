import { useCallback, useEffect, useRef, useState } from 'react'
import { getCampaignRolls, subscribeToRolls } from './services/diceService'
import { getCampaignMembers } from '../members/services/memberService'
import type { DiceRoll, DiceRollWithProfile } from '../../shared/types'

// ────────────────────────────────────────────────────────
// As últimas rolagens da campanha, ao vivo: carrega as mais recentes e deixa
// entrar na lista, pelo Realtime, o que os outros jogadores rolam. A própria
// rolagem entra quando quem rolou chama `reload(true)`.
// ────────────────────────────────────────────────────────

export function formatRelativeTime(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5)   return 'agora'
  if (seconds < 60)  return `${seconds}s atrás`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `${hours}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function useRecentRolls(campaignId: string, currentUserId: string, limit: number) {
  const [history, setHistory]       = useState<DiceRollWithProfile[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Perfis dos membros — resolve o autor de rolagens que chegam pelo
  // Realtime, cujo payload só traz as colunas cruas (sem join de perfil).
  const memberProfilesRef = useRef<Map<string, DiceRollWithProfile['profile']>>(new Map())

  const reload = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else { setLoading(true); setError(null) }
    try {
      const data = await getCampaignRolls(campaignId, limit)
      // Mescla por id em vez de substituir: se uma rolagem de outro
      // jogador chegou via Realtime enquanto essa busca estava em voo,
      // ela não desaparece só porque essa resposta (tirada antes) não a tinha.
      setHistory((prev) => {
        const merged = new Map(data.map((r) => [r.id, r]))
        for (const r of prev) {
          if (!merged.has(r.id)) merged.set(r.id, r)
        }
        return Array.from(merged.values())
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit)
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [campaignId, limit])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    let cancelled = false
    getCampaignMembers(campaignId)
      .then((members) => {
        if (!cancelled) memberProfilesRef.current = new Map(members.map((m) => [m.user_id, m.profile]))
      })
      .catch(() => { /* sem o mapa, rolagem de outro jogador cai no nome genérico */ })
    return () => { cancelled = true }
  }, [campaignId])

  // Rolagem de outro jogador/mestre entra na lista na hora. A própria já é
  // tratada pelo `reload(true)` de quem rolou, então ignora aqui pra não duplicar.
  useEffect(() => {
    const unsubscribe = subscribeToRolls(campaignId, (row: DiceRoll) => {
      if (row.user_id === currentUserId) return
      setHistory((prev) => {
        if (prev.some((r) => r.id === row.id)) return prev
        const profile = memberProfilesRef.current.get(row.user_id) ?? { id: row.user_id, display_name: 'Alguém' }
        return [{ ...row, profile }, ...prev].slice(0, limit)
      })
    })
    return unsubscribe
  }, [campaignId, currentUserId, limit])

  return { history, loading, refreshing, error, reload }
}
