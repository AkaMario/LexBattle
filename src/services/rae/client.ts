type RaeWordResponse = {
  ok: boolean
  data?: {
    word?: string
    meanings?: unknown[]
  }
}

const wordCache = new Map<string, boolean>()

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export async function wordExistsInRae(word: string) {
  const normalized = normalizeLookup(word)

  if (normalized.length < 2) return false
  if (wordCache.has(normalized)) return wordCache.get(normalized) ?? false

  try {
    const response = await fetch(`https://rae-api.com/api/words/${encodeURIComponent(normalized)}`)
    if (!response.ok) {
      wordCache.set(normalized, false)
      return false
    }

    const payload = (await response.json()) as RaeWordResponse
    const exists = Boolean(payload.ok && payload.data?.meanings?.length)

    wordCache.set(normalized, exists)
    return exists
  } catch {
    return false
  }
}
