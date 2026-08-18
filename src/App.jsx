import { useMemo, useState } from 'react'
import dictionary from './data/dictionary.json'

const sortedWords = [...dictionary].sort((a, b) => a.word.localeCompare(b.word))

function App() {
  const [query, setQuery] = useState('')
  const [selectedWord, setSelectedWord] = useState(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sortedWords
    return sortedWords.filter((entry) => entry.word.toLowerCase().includes(q))
  }, [query])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1 className="title">My Dictionary</h1>
          <p className="subtitle">{sortedWords.length} words</p>
        </div>
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
                key={entry.word}
                type="button"
                className={`word-card${selectedWord?.word === entry.word ? ' active' : ''}`}
                onClick={() => setSelectedWord(entry)}
              >
                <span className="word-head">
                  <span className="word">{entry.word}</span>
                  <span className="pos">{entry.partOfSpeech}</span>
                </span>
                <span className="preview">{entry.definition}</span>
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

        <section className={`detail-pane${selectedWord ? ' open' : ''}`}>
          {selectedWord ? (
            <Detail entry={selectedWord} onBack={() => setSelectedWord(null)} />
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
      <p className="detail-phonetic">{entry.phonetic}</p>
      <h2 className="detail-word">{entry.word}</h2>
      <span className="pos badge">{entry.partOfSpeech}</span>

      <section className="block">
        <h3>Definition</h3>
        <p className="definition">{entry.definition}</p>
      </section>

      {entry.example && (
        <section className="block">
          <h3>Example</h3>
          <p className="example">“{entry.example}”</p>
        </section>
      )}
    </div>
  )
}

export default App
