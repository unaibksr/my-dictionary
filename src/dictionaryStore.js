import dictionary from './data/dictionary.json'

const KEY = 'dictionary-extra'

function readExtras() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function getMergedDictionary() {
  return [...dictionary, ...readExtras()]
}

export function saveEntries(entries) {
  const extras = readExtras()
  const seen = new Set(extras.map((e) => e.word.trim().toLowerCase()))
  let added = 0
  for (const e of entries) {
    const k = e.word.trim().toLowerCase()
    if (!e.word || !e.definition || seen.has(k)) continue
    seen.add(k)
    extras.push({ word: e.word, partOfSpeech: e.partOfSpeech, definition: e.definition, example: e.example })
    added++
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(extras))
  } catch {
    return 0
  }
  return added
}

export function clearExtras() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
