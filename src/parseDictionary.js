function normalizePos(input) {
  const s = input.toLowerCase().trim()
  if (s.startsWith('noun')) return 'noun'
  if (s.startsWith('verb')) return 'verb'
  if (s.startsWith('adj')) return 'adjective'
  if (s.startsWith('adv')) return 'adverb'
  if (s.startsWith('prep')) return 'preposition'
  if (s.startsWith('pron')) return 'pronoun'
  if (s.startsWith('conj')) return 'conjunction'
  if (s.startsWith('interj')) return 'interjection'
  return s
}

function parseBlock(block) {
  let line = block.replace(/\s*\n\s*/g, ' ').trim()
  line = line.replace(/\*\*/g, '')
  line = line.replace(/^[\s*+\-—–]+/, '')
  if (!line) return null

  const re =
    /^([\p{L}\p{N}][\p{L}\p{N}'\- ]*?)\s*(?:\(([^)]+)\))?\s*(?:[:\u2014\u2013-]|\n)\s*([\s\S]*)$/u
  const m = line.match(re)
  if (!m) return null

  let word = m[1].trim()
  let pos = ''
  if (m[2] && /(noun|verb|adj|adv|prep|pron|conj|interj|adverb|adjective)/i.test(m[2])) {
    pos = normalizePos(m[2])
  }
  let after = m[3].trim()
  if (!word) return null

  let definition = after
  let example = ''

  const exMatch = definition.match(/\b(?:example|eg|e\.g)\b\s*[:.]?\s*([\s\S]+)$/i)
  if (exMatch) {
    example = exMatch[1].trim().replace(/^["“]|["”]$/g, '').trim()
    example = example.replace(/^[\s,.;:\u2014\u2013-]+/, '').trim()
    definition = definition.slice(0, exMatch.index).trim()
  } else {
    const q = definition.match(/[“"]([^”"]+)[”"]/)
    if (q) {
      example = q[1].trim()
      definition = definition.replace(q[0], ' ').trim()
    }
  }

  definition = definition.replace(/[:\u2014\u2013-]\s*$/, '').replace(/\s{2,}/g, ' ').trim()
  example = example.replace(/[:\u2014\u2013-]\s*$/, '').trim()

  if (!definition) return null

  return { word, partOfSpeech: pos, definition, example }
}

export function parseEntries(text) {
  const raw = (text || '').trim()
  if (!raw) return []
  let blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (blocks.length <= 1) {
    blocks = raw.split(/\r?\n/).map((b) => b.trim()).filter(Boolean)
  }
  const entries = []
  for (const block of blocks) {
    const entry = parseBlock(block)
    if (entry && entry.word && entry.definition) entries.push(entry)
  }
  return entries
}

