import type { GameContext } from '../types/game'
import { wordExistsInSpanishDictionary } from '../services/dictionary/spanishDictionary'

export const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')

export const GAME_CONTEXTS: GameContext[] = [
  'Animales',
  'Paises',
  'Ciudades',
  'Tecnologia',
  'Programacion',
  'Libre',
]

export const WORD_BANK: Record<GameContext, string[]> = {
  Animales: [
    'ardilla',
    'ballena',
    'caballo',
    'delfin',
    'elefante',
    'flamenco',
    'gato',
    'hormiga',
    'iguana',
    'jirafa',
    'koala',
    'leon',
    'mono',
    'nutria',
    'ñandu',
    'oso',
    'perro',
    'quetzal',
    'raton',
    'serpiente',
    'tigre',
    'urraca',
    'vaca',
    'walabi',
    'xoloitzcuintle',
    'yegua',
    'zorro',
  ],
  Paises: [
    'argentina',
    'brasil',
    'colombia',
    'dinamarca',
    'españa',
    'francia',
    'guatemala',
    'haiti',
    'italia',
    'jamaica',
    'kenia',
    'luxemburgo',
    'mexico',
    'nicaragua',
    'oman',
    'panama',
    'qatar',
    'rumania',
    'suecia',
    'turquia',
    'uruguay',
    'venezuela',
    'yemen',
    'zambia',
  ],
  Ciudades: [
    'atenas',
    'bogota',
    'cartagena',
    'dubai',
    'estocolmo',
    'florencia',
    'granada',
    'helsinki',
    'ibague',
    'jerusalen',
    'kioto',
    'londres',
    'madrid',
    'nairobi',
    'oslo',
    'paris',
    'quito',
    'roma',
    'sevilla',
    'tokio',
    'utrecht',
    'valencia',
    'washington',
    'xalapa',
    'yopal',
    'zurich',
  ],
  Tecnologia: [
    'api',
    'backend',
    'cache',
    'docker',
    'endpoint',
    'firebase',
    'git',
    'hosting',
    'internet',
    'javascript',
    'kernel',
    'linux',
    'mongodb',
    'node',
    'oracle',
    'postgres',
    'query',
    'react',
    'supabase',
    'typescript',
    'ubuntu',
    'vite',
    'websocket',
    'xml',
    'yaml',
    'zustand',
  ],
  Programacion: [
    'algoritmo',
    'bucle',
    'compilador',
    'debug',
    'evento',
    'funcion',
    'git',
    'hook',
    'interface',
    'json',
    'lambda',
    'modulo',
    'namespace',
    'objeto',
    'promesa',
    'query',
    'recursion',
    'script',
    'tipado',
    'variable',
  ],
  Libre: [],
}

export function normalizeWord(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const LOCAL_WORD_SET = new Set(Object.values(WORD_BANK).flat().map(normalizeWord))

export async function validateWord(
  word: string,
  letter: string,
  _context: GameContext,
  usedWords: string[],
) {
  const normalized = normalizeWord(word)
  const expectedLetter = normalizeWord(letter)

  if (!normalized) return { isValid: false, reason: 'Escribe una palabra.' }
  if (usedWords.includes(normalized)) return { isValid: false, reason: 'Palabra repetida.' }
  if (!normalized.startsWith(expectedLetter)) {
    return { isValid: false, reason: `Debe iniciar con ${letter}.` }
  }

  if (LOCAL_WORD_SET.has(normalized)) return { isValid: true, reason: '+10 puntos · Banco local OK' }

  if (!(await wordExistsInSpanishDictionary(normalized))) {
    return { isValid: false, reason: 'No aparece en el diccionario.' }
  }

  return { isValid: true, reason: '+10 puntos · Diccionario OK' }
}
