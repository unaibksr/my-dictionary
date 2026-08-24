import { useEffect, useMemo, useRef, useState } from 'react'
import dictionary from './data/dictionary.json'
import Admin from './Admin.jsx'

function buildWords(entries) {
  const map = new Map()
  for (const entry of entries) {
    const id = entry.word.trim().toLowerCase()
    if (!map.has(id)) {
      map.set(id, {
        id,
        word: entry.word,
        senses: [],
      })
    }
    map.get(id).senses.push({
      partOfSpeech: entry.partOfSpeech,
      definition: entry.definition,
      example: entry.example,
    })
  }
  return [...map.values()].sort((a, b) => a.word.localeCompare(b.word))
}

const words = buildWords(dictionary)

export default function App() {
  const [view, setView] = useState('dictionary')

  return view === 'admin' ? (
    <Admin dictionary={dictionary} onBack={() => setView('dictionary')} />
  ) : (
    <DictionaryView onOpenAdmin={() => setView('admin')} />
  )
}

function DictionaryView({ onOpenAdmin }) {
  const [query, setQuery] = useState('')
  const [selectedWord, setSelectedWord] = useState(null)
  const touchStart = useRef(null)

  const goBack = () => {
    setSelectedWord(null)
    history.back()
  }

  const openWord = (entry) => {
    if (selectedWord?.id === entry.id) return
    setSelectedWord(entry)
    history.pushState({ word: entry.id }, '')
  }

  useEffect(() => {
    const onPop = () => setSelectedWord(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const handleTouchStart = (e) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
  }

  const handleTouchEnd = (e) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || !selectedWord) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (dx < -60 && Math.abs(dx) > Math.abs(dy)) {
      goBack()
    }
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return words
    return words.filter((entry) => entry.word.toLowerCase().includes(q))
  }, [query])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1 className="title">My Dictionary</h1>
          <p className="subtitle">{words.length} words</p>
        </div>
        <button type="button" className="admin-link" onClick={onOpenAdmin}>
          Admin
        </button>
        <div className="search">
          <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words"
            aria-label="Search dictionary"
          />
          {query && (
            <button
              type="button"
              className="clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div className="content">
        <aside className="list-pane">
          {results.length > 0 ? (
            results.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`word-card${selectedWord?.id === entry.id ? ' active' : ''}`}
                onClick={() => openWord(entry)}
              >
                <span className="word-head">
                  <span className="word">{entry.word}</span>
                  <span className="pos">{entry.senses[0].partOfSpeech}</span>
                  {entry.senses.length > 1 && (
                    <span className="count">{entry.senses.length} defs</span>
                  )}
                </span>
                <span className="preview">{entry.senses[0].definition}</span>
                <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))
          ) : (
            <div className="empty">
              <p>No words match “{query}”.</p>
            </div>
          )}
        </aside>

        <section
          className={`detail-pane${selectedWord ? ' open' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {selectedWord ? (
            <Detail entry={selectedWord} onBack={goBack} />
          ) : (
            <div className="empty-detail">
              <svg className="empty-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.5v11M6.5 12h11"
                />
              </svg>
              <p>Select a word to see its meaning</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Detail({ entry, onBack }) {
  const multiple = entry.senses.length > 1
  return (
    <div className="detail">
      <button type="button" className="back" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back
      </button>
      <h2 className="detail-word">{entry.word}</h2>

      <div className="senses">
        {entry.senses.map((sense, i) => (
          <section className="sense" key={i}>
            {multiple && <span className="sense-num">{i + 1}</span>}
            <div className="sense-body">
              {sense.partOfSpeech && (
                <span className="pos badge">{sense.partOfSpeech}</span>
              )}
              <p className="definition">{sense.definition}</p>
              {sense.example && <p className="example">“{sense.example}”</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
