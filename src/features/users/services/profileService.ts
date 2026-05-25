import { supabase } from '../../../shared/lib/supabase'
import type { Profile } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Profile Service
// ────────────────────────────────────────────────────────

/**
 * Retorna o perfil do usuário autenticado.
 * A RLS garante que só o próprio perfil seja retornado.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // perfil não existe ainda
    throw new Error('Não foi possível carregar o perfil.')
  }

  return data as Profile
}

/**
 * Garante que o usuário autenticado possui um registro em `profiles`.
 *
 * Necessário para usuários criados antes da migration, já que o trigger
 * `handle_new_user` só age em novos inserts em `auth.users`.
 *
 * A função lê os dados diretamente de `supabase.auth.getUser()` e replica
 * a mesma lógica de prioridade de nome do trigger:
 *   1. display_name (enviado pelo cadastro do front-end)
 *   2. full_name    (Google OAuth)
 *   3. name         (outros providers)
 *   4. parte do e-mail antes do @
 */
export async function ensureProfile(): Promise<Profile> {
  // 1. Obtém dados reais do usuário autenticado
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuário não autenticado.')
  }

  // 2. Se o perfil já existe, retorna sem fazer nada
  const existing = await getCurrentProfile()
  if (existing) return existing

  // 3. Deriva o nome público com a mesma ordem de prioridade do trigger SQL
  const meta = user.user_metadata ?? {}
  const displayName =
    (meta['display_name'] as string | undefined)?.trim() ||
    (meta['full_name']    as string | undefined)?.trim() ||
    (meta['name']         as string | undefined)?.trim() ||
    user.email!.split('@')[0]

  // 4. Cria o perfil
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id:            user.id,
      email:         user.email!,
      display_name:  displayName,
      avatar_url:    (meta['avatar_url'] as string | undefined) ?? null,
      main_provider: (user.app_metadata?.provider as string | undefined) ?? null,
    })
    .select('*')
    .single()

  if (error) {
    // Conflito de chave primária: outro processo criou o perfil entre os dois checks
    if (error.code === '23505') {
      const existing2 = await getCurrentProfile()
      if (existing2) return existing2
    }
    throw new Error('Não foi possível sincronizar o perfil. Tente novamente.')
  }

  return data as Profile
}
