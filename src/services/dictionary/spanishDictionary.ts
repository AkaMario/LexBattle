import { normalizeWord } from '../../utils/gameData'

let dictionaryCache: Set<string> | null = null

export async function getSpanishDictionary() {
  if (dictionaryCache) return dictionaryCache

  const module = await import('an-array-of-spanish-words')
  dictionaryCache = new Set(module.default.map(normalizeWord))

  return dictionaryCache
}

export async function wordExistsInSpanishDictionary(word: string) {
  const dictionary = await getSpanishDictionary()
  return dictionary.has(normalizeWord(word))
}
