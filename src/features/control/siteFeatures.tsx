import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { supabase, uniqueChannel } from '../../shared/lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { MESTRE_FEATURE, mestreChooseHere, mestreToggle, mestreWhere, ownerResetMestre } from '../mestre/mestreService'
import { LIVRO_FEATURE, livroOpenHere, livroToggle, closeMine as livroCloseMine } from '../livro/livroService'
import { TORRE_FEATURE, torreOpenHere, torreToggle, closeMine as torreCloseMine } from '../torre/torreService'

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

export const SITE_FEATURES: SiteFeature[] = [
  {
    key: MESTRE_FEATURE,
    name: 'Raiz Mestre',
    description: 'Botão SE TORNAR UM MESTRE no meio da tela dos jogadores. Só aparece com a chave em "No site" e só na campanha de Altherium que você escolher (ligando com a página dela aberta, ou em "Só nesta campanha"; escolher outra tira o botão da anterior). Quando todos da campanha apertam: livro fechando, 4 s de escuro, site todo preto e dourado e a ficha vira Mestre (todos os triunfos, TORRE). Se você é o mestre da mesa dessa campanha, também vê o botão e, apertando sozinho, só você vira Mestre (teste).',
    where: 'A campanha de Altherium escolhida (qualquer aba)',
    onToggle: mestreToggle,
    actions: [
      { label: 'Só nesta campanha', run: (_u, ctx) => mestreChooseHere(ctx.campaign) },
      { label: 'Em qual campanha está?', run: () => mestreWhere() },
      { label: 'Voltar a ser normal (só você)', run: ownerResetMestre },
    ],
  },
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
