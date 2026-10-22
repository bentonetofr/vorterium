import { supabase } from '../../shared/lib/supabase'
import { DEFAULT_SKIN, getSkin } from './skins'

// ────────────────────────────────────────────────────────
// O conjunto de dados de cada pessoa (profiles.dice_skin, migration
// 20240210), valendo em qualquer aparelho. Sem a migration ou sem rede,
// vale o padrão (Pedra do Vórtice). Fica em memória depois da primeira busca.
// ────────────────────────────────────────────────────────

let cached: { userId: string; skin: string } | null = null
const listeners = new Set<(skin: string) => void>()

/** Avisa quando a pessoa troca o conjunto (a ficha aberta passa a rolar com ele). */
export function onDiceSkinChange(fn: (skin: string) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export async function getMyDiceSkin(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEFAULT_SKIN
  if (cached?.userId === user.id) return cached.skin
  const { data, error } = await supabase.from('profiles').select('dice_skin').eq('id', user.id).maybeSingle()
  const skin = error ? DEFAULT_SKIN : getSkin((data as { dice_skin?: string | null } | null)?.dice_skin).id
  cached = { userId: user.id, skin }
  return skin
}

export async function setMyDiceSkin(skin: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')
  const id = getSkin(skin).id
  const { error } = await supabase.from('profiles').update({ dice_skin: id }).eq('id', user.id)
  if (error) throw new Error('Não foi possível salvar o conjunto de dados. Confira se a migration 20240210 já rodou.')
  cached = { userId: user.id, skin: id }
  listeners.forEach((fn) => fn(id))
}
