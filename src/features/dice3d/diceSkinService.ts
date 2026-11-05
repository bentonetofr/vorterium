import { supabase } from '../../shared/lib/supabase'
import { DEFAULT_SKIN, getSkin } from './skins'

// ────────────────────────────────────────────────────────
// O conjunto de dados de cada pessoa (profiles.dice_skin, migration
// 20240210), valendo em qualquer aparelho. Sem a migration ou sem rede,
// vale o padrão (madeira) — mas só pra aquela rolagem: um erro nunca é
// guardado em memória, senão o padrão ficaria valendo até recarregar a página.
// Fica em memória depois de uma leitura que deu certo; quem vai rolar usa
// `fresh` pra ler o banco de novo (a skin pode ter sido trocada em outro
// aparelho ou aba).
// ────────────────────────────────────────────────────────

let cached: { userId: string; skin: string } | null = null
/** Uma troca que ainda está sendo gravada: quem vai rolar espera ela terminar pra não ler a skin antiga. */
let saving: Promise<void> | null = null
const listeners = new Set<(skin: string) => void>()

/** Avisa quando a pessoa troca o conjunto (a ficha aberta passa a rolar com ele). */
export function onDiceSkinChange(fn: (skin: string) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** O conjunto que já se sabe (de uma leitura anterior), sem ir ao banco. */
export function peekMyDiceSkin(): string | null {
  return cached?.skin ?? null
}

/** O id de quem está logado, lido da sessão guardada (sem ir à rede). */
async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user.id
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * O conjunto de dados da pessoa. `fresh` ignora a memória e lê o banco: é o que
 * quem vai rolar usa, pra rolar sempre com o que está escolhido agora.
 * Se a leitura falhar, vale o último que se sabia (ou o padrão), sem guardar o erro.
 */
export async function getMyDiceSkin(opts: { fresh?: boolean } = {}): Promise<string> {
  if (saving) await saving.catch(() => { /* o erro é de quem trocou */ })
  const userId = await currentUserId()
  if (!userId) return DEFAULT_SKIN
  if (!opts.fresh && cached?.userId === userId) return cached.skin
  const known = cached?.userId === userId ? cached.skin : DEFAULT_SKIN
  const { data, error } = await supabase.from('profiles').select('dice_skin').eq('id', userId).maybeSingle()
  if (error) return known
  const skin = getSkin((data as { dice_skin?: string | null } | null)?.dice_skin).id
  const changed = cached?.userId === userId && cached.skin !== skin
  cached = { userId, skin }
  // outra aba ou aparelho trocou: quem está com a tela aberta passa a usar a nova
  if (changed) listeners.forEach((fn) => fn(skin))
  return skin
}

export function setMyDiceSkin(skin: string): Promise<void> {
  const run = saveSkin(skin)
  saving = run
  const clear = () => { if (saving === run) saving = null }
  void run.then(clear, clear)
  return run
}

async function saveSkin(skin: string): Promise<void> {
  const userId = await currentUserId()
  if (!userId) throw new Error('Usuário não autenticado.')
  const id = getSkin(skin).id
  // .select() devolve as linhas que mudaram: update sem erro e sem linha (perfil bloqueado ou ausente) não gravou nada
  const { data, error } = await supabase.from('profiles').update({ dice_skin: id }).eq('id', userId).select('id')
  if (error) throw new Error('Não foi possível salvar o conjunto de dados. Confira se a migration 20240210 já rodou.')
  if (!data || data.length === 0) throw new Error('Não foi possível salvar o conjunto de dados: seu perfil não foi atualizado.')
  cached = { userId, skin: id }
  listeners.forEach((fn) => fn(id))
}
