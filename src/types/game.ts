export type GamePhase = 'home' | 'lobby' | 'playing' | 'finished'

export type GameContext =
  | 'Animales'
  | 'Paises'
  | 'Ciudades'
  | 'Tecnologia'
  | 'Programacion'
  | 'Libre'

export type Player = {
  id: string
  name: string
  score: number
  errors: number
  isOnline: boolean
  isHost: boolean
}

export type PlayedWord = {
  playerId: string
  letter: string
  word: string
  isValid: boolean
}

export type GameState = {
  roomCode: string
  phase: GamePhase
  hostId: string
  context: GameContext
  players: Player[]
  currentTurnIndex: number
  currentLetterIndex: number
  usedWords: string[]
  history: PlayedWord[]
  roundStartedAt: number
  winnerId?: string
  message: string
}

export type RealtimeEvent =
  | { type: 'sync-request'; player: Player }
  | { type: 'state'; state: GameState }
