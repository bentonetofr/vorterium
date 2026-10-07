import { createContext } from 'react'

/**
 * Nome do recurso que os painéis de triunfo mostram ("FV", "PR"…). null =
 * o padrão de cada painel. (A raiz Mestre, guardada em guardado/raiz-mestre/,
 * usava 'Torre'.)
 */
export const TriumphUnit = createContext<string | null>(null)
