import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Vorterium] Variáveis de ambiente do Supabase não encontradas.\n' +
    'Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas no arquivo .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

let channelSeq = 0

/**
 * Nome único pra um canal que só escuta o banco (postgres_changes). Desde o
 * supabase-js 2.117, dois `.channel()` com o mesmo nome devolvem o MESMO
 * canal, e acrescentar `.on()` nele depois do `subscribe()` dá erro e
 * derruba a página (ex.: a página do mestre e a janela do caderno abertas
 * juntas). Pra esse tipo de canal o nome não importa — quem escolhe os
 * eventos é o `filter`. NÃO usar em canal de broadcast/presence: ali o nome
 * é a "sala" que todo mundo precisa compartilhar.
 */
export function uniqueChannel(base: string): string {
  channelSeq += 1
  return `${base}:${channelSeq}`
}
