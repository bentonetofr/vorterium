import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  DndCharacterClass, DndCharacterFeature, DndCharacterProficiency, DndCharacterResource, DndHpMode, DndSheetDetails,
} from '../../../../shared/types'
import { getDndSheetDetails, listDndProficiencies } from '../services/dndSheetService'
import { listDndClasses } from '../services/dndClassService'
import { listDndFeatures, listDndResources } from '../services/dndResourceService'
import { DEFAULT_HP_MODE, getDndHpMode } from '../services/dndCampaignService'

// ────────────────────────────────────────────────────────
// Carrega e guarda as partes repetíveis da ficha D&D: classes, perícias,
// ataques, inventário, magias, sobrescritas, proficiências extras, recursos e
// características. Quem edita atualiza o estado daqui depois de salvar.
// ────────────────────────────────────────────────────────

export interface DndSheetData {
  loading:       boolean
  error:         string | null
  /** Alguma tabela da ficha nova não carregou (migration por rodar, rede): a tela não grava o que depende delas. */
  degraded:      boolean
  classes:       DndCharacterClass[]
  details:       DndSheetDetails
  proficiencies: DndCharacterProficiency[]
  resources:     DndCharacterResource[]
  features:      DndCharacterFeature[]
  hpMode:        DndHpMode
  setClasses:       Dispatch<SetStateAction<DndCharacterClass[]>>
  setDetails:       Dispatch<SetStateAction<DndSheetDetails>>
  setProficiencies: Dispatch<SetStateAction<DndCharacterProficiency[]>>
  setResources:     Dispatch<SetStateAction<DndCharacterResource[]>>
  setFeatures:      Dispatch<SetStateAction<DndCharacterFeature[]>>
  reload:           () => Promise<void>
}

const EMPTY_DETAILS: DndSheetDetails = { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }


export function useDndSheetData(sheetId: string, campaignId: string): DndSheetData {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [classes, setClasses]   = useState<DndCharacterClass[]>([])
  const [details, setDetails]   = useState<DndSheetDetails>(EMPTY_DETAILS)
  const [proficiencies, setProficiencies] = useState<DndCharacterProficiency[]>([])
  const [resources, setResources] = useState<DndCharacterResource[]>([])
  const [features, setFeatures] = useState<DndCharacterFeature[]>([])
  const [hpMode, setHpMode]     = useState<DndHpMode>(DEFAULT_HP_MODE)
  const [degraded, setDegraded] = useState(false)

  const load = useCallback(async () => {
    // As tabelas da ficha nova podem não existir ainda (migration por rodar): ficam vazias e a tela avisa o resto.
    let failed = false
    const softly = <T,>(job: Promise<T>, fallback: T): Promise<T> => job.catch(() => { failed = true; return fallback })
    const [det, cls, prof, res, feat, mode] = await Promise.all([
      getDndSheetDetails(sheetId),
      softly(listDndClasses(sheetId), [] as DndCharacterClass[]),
      softly(listDndProficiencies(sheetId), [] as DndCharacterProficiency[]),
      softly(listDndResources(sheetId), [] as DndCharacterResource[]),
      softly(listDndFeatures(sheetId), [] as DndCharacterFeature[]),
      softly(getDndHpMode(campaignId), DEFAULT_HP_MODE),
    ])
    setDetails(det); setClasses(cls); setProficiencies(prof); setResources(res); setFeatures(feat); setHpMode(mode)
    setDegraded(failed)
  }, [sheetId, campaignId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    load()
      .then(() => { if (alive) setError(null) })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [load])

  return {
    loading, error, degraded, classes, details, proficiencies, resources, features, hpMode,
    setClasses, setDetails, setProficiencies, setResources, setFeatures,
    reload: load,
  }
}
