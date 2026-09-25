import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationDirectory = resolve(process.cwd(), 'supabase', 'migrations')

const expectedMigrations = [
  '20240101000000_initial_schema.sql',
  '20240102000000_campaign_members.sql',
  '20240103000000_harden_campaign_members_insert.sql',
  '20240104000000_character_sheets.sql',
  '20240105000000_dice_rolls.sql',
  '20240106000000_harden_character_sheets_and_dice.sql',
  '20240107000000_allow_profile_self_insert.sql',
  '20240108000000_campaign_invites.sql',
  '20240109000000_improve_campaign_invites.sql',
  '20240110000000_campaign_management.sql',
  '20240111000000_improve_dice_rolls.sql',
  '20240112000000_custom_dice_rolls.sql',
  '20240113000000_campaign_sessions.sql',
  '20240114000000_harden_campaign_sessions.sql',
  '20240115000000_campaign_description_status.sql',
  '20240116000000_harden_campaign_structural_fields.sql',
  '20240117000000_campaign_activity_presence.sql',
  '20240118000000_harden_campaign_activity_rpc.sql',
  '20240119000000_session_status.sql',
  '20240120000000_campaign_notes.sql',
  '20240122000000_remove_custom_campaign_system.sql',
  '20240123000000_dnd_character_sheets_base.sql',
  '20240125000000_dnd_abilities_saves.sql',
  '20240126000000_profile_preferences_and_media.sql',
  '20240127000000_dnd_sheet_details.sql',
  '20240128000000_dnd_rules_engine.sql',
  '20240129000000_dnd_equipment_catalog.sql',
  '20240130000000_dice_keep_lowest.sql',
  '20240131000000_dice_private_rolls.sql',
  '20240132000000_notification_seen_at.sql',
  '20240133000000_campaign_chat.sql',
  '20240134000000_campaign_messages_replica_identity.sql',
  '20240135000000_private_messages.sql',
  '20240136000000_dice_rolls_realtime.sql',
  '20240137000000_leave_campaign_atomic_activity.sql',
  '20240138000000_campaign_initiative.sql',
  '20240139000000_altherium_character_sheets.sql',
  '20240140000000_altherium_vitality_equilibrio_max.sql',
  '20240141000000_altherium_portrait.sql',
  '20240142000000_altherium_inventory.sql',
  '20240143000000_altherium_wound_tracking.sql',
  '20240144000000_altherium_berserker_triumphs.sql',
  '20240145000000_altherium_runaskin_runes.sql',
  '20240146000000_altherium_fv_pr_max.sql',
  '20240147000000_altherium_sheets_realtime.sql',
  '20240148000000_altherium_runes_action_range.sql',
  '20240149000000_triumph_used_activity.sql',
  '20240150000000_altherium_custom_inventory_items.sql',
  '20240151000000_altherium_custom_weapon_stats.sql',
  '20240152000000_altherium_bestiary.sql',
  '20240153000000_mesa_screen_share_realtime.sql',
  '20240154000000_mesa_live_notice_and_gallery.sql',
  '20240155000000_altherium_pilar_cards.sql',
  '20240156000000_altherium_runaskin_trail_overrides.sql',
  '20240157000000_terra_devastada.sql',
]

const actualMigrations = readdirSync(migrationDirectory)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()

const errors = []

if (actualMigrations.length !== expectedMigrations.length) {
  errors.push(
    `Quantidade inesperada: encontrado ${actualMigrations.length}, esperado ${expectedMigrations.length}.`,
  )
}

if (actualMigrations.some((fileName, index) => fileName !== expectedMigrations[index])) {
  errors.push('A ordem lexicográfica das migrations não corresponde ao contrato registrado.')
}

const expectedSet = new Set(expectedMigrations)
const actualSet = new Set(actualMigrations)

for (const fileName of expectedMigrations) {
  if (!actualSet.has(fileName)) errors.push(`Migration ausente: ${fileName}`)
}

for (const fileName of actualMigrations) {
  if (!expectedSet.has(fileName)) errors.push(`Migration não registrada: ${fileName}`)
}

for (const fileName of actualMigrations) {
  const path = resolve(migrationDirectory, fileName)
  if (statSync(path).size === 0) errors.push(`Migration vazia: ${fileName}`)
  if (!readFileSync(path, 'utf8').trim()) errors.push(`Migration sem conteúdo: ${fileName}`)
}

if (errors.length > 0) {
  console.error('Contrato de migrations inválido:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Contrato de migrations OK: ${actualMigrations.length} arquivos em ordem.`)
