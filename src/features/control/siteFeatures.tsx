import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { supabase, uniqueChannel } from '../../shared/lib/supabase'
import { useObserver } from '../../shared/lib/observer'
import { useAuth } from '../auth/AuthProvider'
import { LIVRO_FEATURE, livroOpenHere, livroToggle, closeMine as livroCloseMine } from '../livro/livroService'
import { TORRE_FEATURE, torreOpenHere, torreToggle, closeMine as torreCloseMine } from '../torre/torreService'
import { VAMPIRO_FEATURE } from '../sheets/vampiro/constants/vampiro'
import { DND_FEATURE } from '../sheets/dnd/constants/dnd'

// ────────────────────────────────────────────────────────
// Recursos que o dono do site controla pelo Painel de controle (o livro
// vinho do canto): cada um fica GUARDADO (só o dono vê, pra testar) ou vai
// PRO SITE (todo mundo vê). O estado fica na tabela site_features (todos
// leem, só o dono do site muda — tabela app_owners, pelo SQL Editor) e
// chega em tempo real. Dono do site ≠ conta de desenvolvedor (a do /dev).
//
// Recurso novo: põe aqui em SITE_FEATURES e, no lugar dele no site, usa
// useFeature('chave').visible (ou <Feature name="chave">…</Feature>).
// Sem linha no banco = guardado. Recursos que já são do site pra sempre
// (PERMANENT_FEATURES) não dependem do banco nem aparecem no painel.
// ────────────────────────────────────────────────────────

/** Onde o dono está ao mexer no painel (ex.: qual campanha está aberta). */
export interface FeatureContext {
  userId:   string | null
  campaign: { id: string; name: string; master: boolean } | null
}

export interface SiteFeature {
  /** Chave no banco: minúsculas, números, - e _. */
  key:         string
  name:        string
  description: string
  /** Onde aparece no site (pra achar e testar). */
  where:       string
  /** Botões de teste do dono no painel (ex.: voltar ao normal). Podem devolver um aviso. */
  actions?:    { label: string; run: (userId: string | null, ctx: FeatureContext) => Promise<string | void> }[]
  /** Ao ligar/desligar (ex.: abrir o jogo na campanha aberta). Pode devolver um aviso. */
  onToggle?:   (enabled: boolean, ctx: FeatureContext) => Promise<string | void>
}

/** Recursos que já foram pro site de vez: sempre ligados, mesmo sem linha no banco (o D&D 5e, no patch 2.0). */
export const PERMANENT_FEATURES: ReadonlySet<string> = new Set([DND_FEATURE])

export const SITE_FEATURES: SiteFeature[] = [
  {
    key: LIVRO_FEATURE,
    name: 'O Livro Bloqueado',
    description: 'Joguinho em pixel art pra 2 jogadores da sessão (os outros e você assistem). Ligando com a página da campanha aberta, o jogo cobre a tela de todo mundo dela, no saguão, e você escolhe quem joga. Guardado, só você vê: use "Abrir nesta campanha" pra testar.',
    where: 'Por cima do site, na campanha aberta',
    onToggle: livroToggle,
    actions: [
      { label: 'Abrir nesta campanha', run: (_u, ctx) => livroOpenHere(ctx.campaign) },
      { label: 'Encerrar', run: async () => { const n = await livroCloseMine(); return n ? 'Encerrado.' : 'Não tinha jogo aberto.' } },
    ],
  },
  {
    key: TORRE_FEATURE,
    name: 'A Torre do Observatório',
    description: 'Joguinho em pixel art pra exatamente 2 jogadores da sessão, um em cada andar da torre (eles não se veem, só se ouvem: precisam falar pela voz). Os outros e você assistem os dois andares. Ligando com a página da campanha aberta, o jogo cobre a tela de todo mundo dela, no saguão. Guardado, só você vê: use "Abrir nesta campanha" pra testar.',
    where: 'Por cima do site, na campanha aberta',
    onToggle: torreToggle,
    actions: [
      { label: 'Abrir nesta campanha', run: (_u, ctx) => torreOpenHere(ctx.campaign) },
      { label: 'Encerrar', run: async () => { const n = await torreCloseMine(); return n ? 'Encerrado.' : 'Não tinha jogo aberto.' } },
    ],
  },
  {
    key: VAMPIRO_FEATURE,
    name: 'Vampiro: A Máscara',
    description: 'Sistema novo (5ª edição): campanhas de Vampiro com ficha própria (clã, atributos e perícias, Vitalidade e Força de Vontade com dano superficial e agravado, Fome, Humanidade com manchas e Potência de Sangue). Guardado, só você cria campanha de Vampiro e só você vê, cria e edita fichas de Vampiro (mesmo convidando alguém).',
    where: 'Criação de campanha e a aba Ficha das campanhas de Vampiro',
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

// ── Acesso liberado pelo e-mail ─────────────────────────
// Além do dono, o dono do site pode liberar um recurso guardado para contas
// específicas (tabela site_feature_access, pelo SQL Editor). Essas pessoas
// veem e usam o recurso como jogador e como mestre, sem o site inteiro ver.

const accessCache = new Map<string, Promise<string[]>>()

/** Os recursos guardados liberados pra esta conta. (Sem a migration, nenhum.) */
export function loadFeatureAccess(userId: string): Promise<string[]> {
  let cached = accessCache.get(userId)
  if (!cached) {
    cached = Promise.resolve(supabase.rpc('my_feature_access'))
      .then(({ data, error }) => (error || !Array.isArray(data) ? [] : (data as string[])))
      .catch(() => [] as string[])
    accessCache.set(userId, cached)
  }
  return cached
}

/** As chaves dos recursos liberados pra conta logada (vazio enquanto confere). */
export function useFeatureAccess(): ReadonlySet<string> {
  const { user } = useAuth()
  const [access, setAccess] = useState<{ id: string; keys: string[] } | null>(null)
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    void loadFeatureAccess(user.id).then((keys) => { if (alive) setAccess({ id: user.id, keys }) })
    return () => { alive = false }
  }, [user?.id])
  return new Set(user?.id && access?.id === user.id ? access.keys : [])
}

/**
 * Um recurso: `on` = está no site pra todos; `visible` = aparece pra quem
 * está vendo (no site, ou guardado mas é o dono testando ou uma conta com
 * acesso liberado); `guarded` = alguém está vendo algo que ainda está
 * guardado (bom pra pôr um selo).
 */
export function useFeature(key: string): { on: boolean; visible: boolean; guarded: boolean } {
  const { rows } = useSiteFeatures()
  const owner = useIsSiteOwner()
  const allowed = useFeatureAccess().has(key)
  const on = PERMANENT_FEATURES.has(key) || rows[key]?.enabled === true
  // a conta dev (observadora) vê tudo o que a campanha usa, inclusive o que ainda está guardado
  const observer = useObserver()
  const early = owner || allowed || observer
  return { on, visible: on || early, guarded: !on && early }
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
