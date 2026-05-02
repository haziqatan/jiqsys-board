import { supabase, DEFAULT_BOARD_ID } from './supabase'

export async function ensureBoard(id = DEFAULT_BOARD_ID) {
  const { data } = await supabase.from('boards').select('*').eq('id', id).maybeSingle()
  if (data) return data
  const { data: created, error } = await supabase
    .from('boards')
    .insert({ id, name: 'Default Board' })
    .select()
    .single()
  if (error) throw error
  return created
}

export async function fetchCards(boardId) {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchConnectors(boardId) {
  const { data, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('board_id', boardId)
  if (error) throw error
  return data || []
}

export async function createCard(boardId, partial = {}) {
  const { data, error } = await supabase
    .from('cards')
    .insert({ board_id: boardId, ...partial })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCard(id, patch) {
  const { data, error } = await supabase
    .from('cards')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCard(id) {
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}

export async function createConnector(boardId, sourceId, targetId, opts = {}) {
  const { data, error } = await supabase
    .from('connectors')
    .insert({
      board_id: boardId,
      source_card_id: sourceId,
      target_card_id: targetId,
      ...opts,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateConnector(id, patch) {
  const { data, error } = await supabase
    .from('connectors')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteConnector(id) {
  const { error } = await supabase.from('connectors').delete().eq('id', id)
  if (error) throw error
}
