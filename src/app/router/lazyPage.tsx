import { lazy, type ComponentType } from 'react'
import { Loader } from '../../shared/components/Loader'

// ────────────────────────────────────────────────────────
// Página carregada sob demanda: o código dela só é baixado quando a pessoa
// chega na rota. (O CSS não: vem todo de uma vez, em src/styles.ts.)
//
// Depois de uma publicação nova, a aba que já estava aberta ainda aponta
// pros arquivos da versão antiga, que não existem mais no servidor. Em vez
// de quebrar com a tela em branco, a primeira falha recarrega a página
// uma vez (pega a versão nova); se falhar de novo, o erro segue adiante.
// ────────────────────────────────────────────────────────

const RELOADED_KEY = 'vorterium:recarregou-por-versao'

function reloadOnce(error: unknown): never {
  let already = false
  try { already = sessionStorage.getItem(RELOADED_KEY) === '1' } catch { /* sem armazenamento */ }
  if (!already && typeof window !== 'undefined') {
    try { sessionStorage.setItem(RELOADED_KEY, '1') } catch { /* sem armazenamento */ }
    window.location.reload()
  }
  throw error
}

/** Carregou uma página com sucesso: a próxima falha pode recarregar de novo. */
function loadedFine() {
  try { sessionStorage.removeItem(RELOADED_KEY) } catch { /* sem armazenamento */ }
}

/**
 * `lazyPage(() => import('./Pagina'), 'Pagina')` — como o React.lazy, mas
 * pra componentes exportados pelo nome e com a recarga em caso de versão velha.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<M extends Record<string, any>, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
) {
  return lazy(() =>
    load().then(
      (m) => { loadedFine(); return { default: m[name] as ComponentType } },
      reloadOnce,
    ),
  )
}

/** Tela cheia de espera, enquanto o código de um layout inteiro chega. */
export function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <Loader />
    </div>
  )
}

/** Espera de uma página dentro do layout (a barra lateral continua no lugar). */
export function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '50vh' }}>
      <Loader />
    </div>
  )
}
