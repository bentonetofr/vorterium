import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { supabase, uniqueChannel } from '../../shared/lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { MESTRE_FEATURE, ownerResetMestre } from '../mestre/mestreService'

// ────────────────────────────────────────────────────────
// Recursos que o dono do site controla pelo Painel de controle (o livro
// vinho do canto): cada um fica GUARDADO (só o dono vê, pra testar) ou vai
// PRO SITE (todo mundo vê). O estado fica na tabela site_features (todos
// leem, só o dono do site muda — tabela app_owners, pelo SQL Editor) e
// chega em tempo real. Dono do site ≠ conta de desenvolvedor (a do /dev).
//
// Recurso novo: põe aqui em SITE_FEATURES e, no lugar dele no site, usa
// useFeature('chave').visible (ou <Feature name="chave">…</Feature>).
// Sem linha no banco = guardado.
// ────────────────────────────────────────────────────────

export interface SiteFeature {
  /** Chave no banco: minúsculas, números, - e _. */
  key:         string
  name:        string
  description: string
  /** Onde aparece no site (pra achar e testar). */
  where:       string
  /** Botões de teste do dono no painel (ex.: voltar ao normal). */
  actions?:    { label: string; run: (userId: string | null) => Promise<void> }[]
}

export const SITE_FEATURES: SiteFeature[] = [
  {
    key: MESTRE_FEATURE,
    name: 'Raiz Mestre',
    description: 'Botão SE TORNAR UM MESTRE no meio da tela dos jogadores de Altherium. Quando todos da campanha apertam: livro fechando, 4 s de escuro, tema preto e dourado e a ficha vira Mestre (todos os triunfos, TORRE). Guardado, só você vê o botão — e ele vale só pra você.',
    where: 'Campanhas de Altherium (qualquer aba)',
    actions: [{ label: 'Voltar a ser normal (só você)', run: ownerResetMestre }],
  },
]

// ── Quem é o dono do site ───────────────────────────────

const ownerCache = new Map<string, Promise<boolean>>()

/** A conta logada é a do dono do site? (Sem a migration, sempre false.) */
export function checkIsSiteOwner(userId: string): Promise<boolean> {
  let cached = ownerCache.get(userId)
  if (!cached) {
    cached = Promise.resolve(supabase.rpc('is_site_owner'))
      .then(({ data, error }) => !error && data === true)
      .catch(() => false)
    ownerCache.set(userId, cached)
  }
  return cached
}

/** true/false (false enquanto confere, e pra quem não está logado). */
export function useIsSiteOwner(): boolean {
  const { user } = useAuth()
  const [owner, setOwner] = useState<{ id: string; yes: boolean } | null>(null)
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    void checkIsSiteOwner(user.id).then((yes) => { if (alive) setOwner({ id: user.id, yes }) })
    return () => { alive = false }
  }, [user?.id])
  return !!user?.id && owner?.id === user.id && owner.yes
}

// ── Estado dos recursos ─────────────────────────────────

export interface FeatureRow { key: string; enabled: boolean; updated_at: string }

interface Store { loaded: boolean; rows: Record<string, FeatureRow> }

let store: Store = { loaded: false, rows: {} }
const listeners = new Set<() => void>()
let started = false

function emit(next: Store) {
  store = next
  listeners.forEach((l) => l())
}

async function load() {
  const { data, error } = await supabase.from('site_features').select('key, enabled, updated_at')
  // Sem a migration (ou sem rede): tudo fica guardado.
  const rows = error ? {} : Object.fromEntries((data ?? []).map((r) => [r.key as string, r as FeatureRow]))
  emit({ loaded: true, rows })
}

function start() {
  if (started) return
  started = true
  void load()
  supabase
    .channel(uniqueChannel('site-features'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_features' }, () => { void load() })
    .subscribe()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** O estado de todos os recursos (carrega na primeira vez e fica ouvindo). */
export function useSiteFeatures(): Store {
  useEffect(start, [])
  return useSyncExternalStore(subscribe, () => store)
}

/**
 * Um recurso: `on` = está no site pra todos; `visible` = aparece pra quem
 * está vendo (no site, ou guardado mas é o dono testando); `guarded` = o
 * dono está vendo algo que ainda está guardado (bom pra pôr um selo).
 */
export function useFeature(key: string): { on: boolean; visible: boolean; guarded: boolean } {
  const { rows } = useSiteFeatures()
  const owner = useIsSiteOwner()
  const on = rows[key]?.enabled === true
  return { on, visible: on || owner, guarded: !on && owner }
}

/** Mostra o conteúdo só se o recurso estiver no site (ou pro dono, testando). */
export function Feature({ name, children, fallback = null }: { name: string; children: ReactNode; fallback?: ReactNode }) {
  return <>{useFeature(name).visible ? children : fallback}</>
}

/** Liga (pro site) ou desliga (guarda) um recurso. Só o dono do site consegue. */
export async function setFeature(key: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('site_features').upsert({ key, enabled }, { onConflict: 'key' })
  if (error) throw new Error('Não foi possível mudar o recurso. Confira se a migration do painel de controle já rodou.')
  await load()
}
