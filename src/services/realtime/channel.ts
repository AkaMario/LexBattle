import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import type { RealtimeEvent } from '../../types/game'

export function createRoomChannel(
  roomCode: string,
  onEvent: (event: RealtimeEvent) => void,
) {
  if (!supabase) return null

  const channel = supabase.channel(`lexbattle:${roomCode}`, {
    config: {
      broadcast: { self: false },
      presence: { key: roomCode },
    },
  })

  channel.on('broadcast', { event: 'game-event' }, ({ payload }) => {
    onEvent(payload as RealtimeEvent)
  })

  channel.subscribe()

  return channel
}

export function broadcastGameEvent(channel: RealtimeChannel | null, event: RealtimeEvent) {
  if (!channel) return

  void channel.send({
    type: 'broadcast',
    event: 'game-event',
    payload: event,
  })
}
