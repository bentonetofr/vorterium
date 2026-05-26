import { supabase } from '../../../shared/lib/supabase'
import type { Profile } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Profile Service
// ────────────────────────────────────────────────────────

/**
 * Retorna o perfil do usuário autenticado, ou null se não existir.
 *
 * Obtém o user.id explicitamente via auth.getUser() e filtra a query
 * com .eq('id', user.id) + maybeSingle() para não depender exclusivamente
 * do RLS e evitar erros falsos quando o perfil existe mas a sessão
 * não passou o filtro implícito do .single().
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error('Não foi possível carregar o perfil.')
  return data as Profile | null
}

/**
 * Atualiza o nome público do usuário autenticado.
 * Envia apenas display_name — nunca e-mail, id ou outros campos.
 */
export async function updateCurrentProfile(
  data: { display_name: string }
): Promise<Profile> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Usuário não autenticado.')

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ display_name: data.display_name.trim() })
    .eq('id', user.id)
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível atualizar o perfil.')
  return updated as Profile
}

/**
 * Garante que o usuário autenticado possui um registro em public.profiles.
 *
 * Fluxo:
 *  1. Obtém user via auth.getUser()
 *  2. Busca perfil por id = user.id com maybeSingle()
 *  3. Se existir, retorna imediatamente
 *  4. Se não existir, cria o perfil
 *  5. Busca novamente após o insert (evita depender do retorno do INSERT,
 *     que pode ser afetado por policies de SELECT pós-insert)
 *
 * Lida com race condition (23505 = duplicate key) buscando novamente
 * em vez de lançar erro.
 */
export async function ensureProfile(): Promise<Profile> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Usuário não autenticado.')

  // 1. Tenta buscar o perfil existente
  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (selectError) {
    console.error('Erro ao buscar perfil:', selectError)
    throw new Error('Não foi possível verificar o perfil.')
  }

  if (existing) return existing as Profile

  // 2. Perfil não existe — cria com os dados do auth
  const meta = user.user_metadata ?? {}
  const displayName =
    (meta['display_name'] as string | undefined)?.trim() ||
    (meta['full_name']    as string | undefined)?.trim() ||
    (meta['name']         as string | undefined)?.trim() ||
    user.email!.split('@')[0]

  const { error: insertError } = await supabase
    .from('profiles')
    .insert({
      id:            user.id,
      email:         user.email!,
      display_name:  displayName,
      avatar_url:    (meta['avatar_url'] as string | undefined) ?? null,
      main_provider: (user.app_metadata?.provider as string | undefined) ?? 'email',
    })

  // 23505 = conflito de chave primária: outro processo criou o perfil
  // entre o SELECT e o INSERT — tenta buscar novamente
  if (insertError && insertError.code !== '23505') {
    console.error('Erro ao criar perfil:', insertError)
    throw new Error('Não foi possível sincronizar o perfil. Tente novamente.')
  }

  // 3. Busca o perfil após insert (tanto para insert bem-sucedido quanto para race condition)
  const { data: created, error: refetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (refetchError || !created) {
    console.error('Erro ao buscar perfil após criação:', refetchError)
    throw new Error('Não foi possível carregar o perfil após sincronização.')
  }

  return created as Profile
}
