import { supabase } from './client'
import type { GameState, Player } from '../../types/game'

export async function createGuestProfile(player: Player) {
  if (!supabase) throw new Error('Supabase no esta configurado.')

  const { error } = await supabase.from('profiles').upsert(
    {
      id: player.id,
      username: player.name,
      is_guest: true,
    },
    { onConflict: 'id' },
  )

  if (error) throw error
}

export async function createOnlineRoom(state: GameState) {
  if (!supabase) throw new Error('Supabase no esta configurado.')

  await createGuestProfile(state.players[0])

  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      room_code: state.roomCode,
      host_id: state.hostId,
      status: state.phase,
      context: state.context,
      current_turn: state.players[state.currentTurnIndex]?.id ?? state.hostId,
      current_letter: 'A',
      current_letter_index: state.currentLetterIndex,
    })
    .select('id')
    .single()

  if (gameError) throw gameError

  const { error: playerError } = await supabase.from('players').insert({
    game_id: game.id,
    user_id: state.hostId,
    score: 0,
    errors: 0,
    position: 0,
    is_online: true,
  })

  if (playerError) throw playerError

  await saveRoomState(state)
}

export async function getRoomState(roomCode: string) {
  if (!supabase) throw new Error('Supabase no esta configurado.')

  const { data, error } = await supabase
    .from('room_states')
    .select('state')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (error) throw error

  return (data?.state as GameState | undefined) ?? null
}

export async function joinOnlineRoom(roomCode: string, player: Player) {
  if (!supabase) throw new Error('Supabase no esta configurado.')

  await createGuestProfile(player)

  const currentState = await getRoomState(roomCode)
  if (!currentState) throw new Error('No existe una sala con ese codigo.')
  if (currentState.phase !== 'lobby') throw new Error('La partida ya comenzo.')

  const players = currentState.players.some((currentPlayer) => currentPlayer.id === player.id)
    ? currentState.players.map((currentPlayer) =>
        currentPlayer.id === player.id ? { ...currentPlayer, name: player.name, isOnline: true } : currentPlayer,
      )
    : [...currentState.players, { ...player, isHost: false }]
  const nextState = {
    ...currentState,
    players,
    message: `${player.name} entro a la sala.`,
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id')
    .eq('room_code', roomCode)
    .single()

  if (gameError) throw gameError

  const { error: playerError } = await supabase.from('players').upsert(
    {
      game_id: game.id,
      user_id: player.id,
      score: 0,
      errors: 0,
      position: players.findIndex((currentPlayer) => currentPlayer.id === player.id),
      is_online: true,
    },
    { onConflict: 'game_id,user_id' },
  )

  if (playerError) throw playerError

  await saveRoomState(nextState)

  return nextState
}

export async function saveRoomState(state: GameState) {
  if (!supabase || state.roomCode === 'SOLO') return

  const currentPlayer = state.players[state.currentTurnIndex]
  const currentLetter = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')[state.currentLetterIndex] ?? 'A'
  const { error } = await supabase.from('room_states').upsert(
    {
      room_code: state.roomCode,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'room_code' },
  )

  if (error) throw error

  const { error: gameError } = await supabase
    .from('games')
    .update({
      status: state.phase,
      context: state.context,
      current_turn: currentPlayer?.id ?? state.hostId,
      current_letter: currentLetter,
      current_letter_index: state.currentLetterIndex,
    })
    .eq('room_code', state.roomCode)

  if (gameError) throw gameError
}
