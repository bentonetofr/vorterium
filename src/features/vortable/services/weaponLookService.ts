import { supabase } from '../../../shared/lib/supabase'
import { applyWeaponLook, type WeaponLook } from '../../sheets/terraDevastadaAdaptada/utils/tdaWeaponLook'
import type { Appearance } from '../../../vendor/vortable/vortable'

// ────────────────────────────────────────────────────────
// Grava no boneco do Vortable as armas que a ficha mostra. O boneco é a
// linha de vortable_characters: o que a pessoa joga (controller_id) ou o
// personagem de um NPC especial (id fixo). Só os espaços de arma mudam, e só
// se mudaram de verdade. Falha em silêncio (RLS: só o dono mexe no boneco):
// a ficha nunca deve quebrar por causa do desenho.
// ────────────────────────────────────────────────────────

const lastDone = new Map<string, string>()

export interface WeaponLookTarget {
  campaignId:    string
  /** O boneco que esta pessoa joga na campanha. */
  controllerId?: string
  /** Ou um boneco específico (NPC especial). */
  characterId?:  string
}

export async function syncWeaponLook(target: WeaponLookTarget, look: WeaponLook, force = false): Promise<void> {
  const key = `${target.campaignId}:${target.characterId ?? target.controllerId}`
  const sig = JSON.stringify(look)
  if (!force && lastDone.get(key) === sig) return

  let query = supabase.from('vortable_characters').select('id, appearance').eq('campaign_id', target.campaignId)
  query = target.characterId ? query.eq('id', target.characterId) : query.eq('controller_id', target.controllerId ?? '')
  const { data, error } = await query.maybeSingle()
  if (error || !data) return

  const current = data.appearance as Appearance
  const next = applyWeaponLook(current, look)
  if (JSON.stringify(next.slots) !== JSON.stringify(current.slots)) {
    const res = await supabase
      .from('vortable_characters').update({ appearance: next })
      .eq('campaign_id', target.campaignId).eq('id', data.id as string)
    if (res.error) return
  }
  lastDone.set(key, sig)
}
