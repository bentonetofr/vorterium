import { createContext } from 'react'

/**
 * Nome do recurso que os painéis de triunfo mostram ("FV", "PR"…). A raiz
 * Mestre usa os painéis das três raízes pagando tudo em TORRE: ela envolve
 * os painéis com este contexto valendo 'Torre'. null = o padrão de cada painel.
 */
export const TriumphUnit = createContext<string | null>(null)
