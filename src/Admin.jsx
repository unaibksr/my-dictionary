import { useState } from 'react'
import { parseEntries } from './parseDictionary.js'

const FIELDS = ['word', 'partOfSpeech', 'definition', 'example']

export default function Admin({ dictionary, onBack }) {
  const [text, setText] = useState('')
  const [entries, setEntries] = useState([])

  const existing = new Set(dictionary.map((e) => e.word.trim().toLowerCase()))

  const handleParse = () => {
    setEntries(parseEntries(text))
  }

  const updateEntry = (i, field, value) => {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))
  }

  const removeEntry = (i) => {
    setEntries((es) => es.filter((_, idx) => idx !== i))
  }

  const duplicates = entries.filter((e) => existing.has(e.word.trim().toLowerCase()))

  const merged = [...dictionary, ...entries]

  const download = () => {
    const json = JSON.stringify(merged, null, 2) + '\n'
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dictionary.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    const json = JSON.stringify(merged, null, 2) + '\n'
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      window.prompt('Copy the JSON below:', json)
    }
  }

  return (
    <div className="admin">
      <header className="admin-header">
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
        <h1 className="title">Admin</h1>
      </header>

      <div className="admin-body">
        <p className="admin-help">
          Paste words with meanings and example sentences, one per line or blank-line
          separated. Format:
        </p>
        <pre className="admin-sample">
          {`Abundant (adjective) — Existing or available in large quantities; plentiful. Example: The region has abundant resources.
Benevolent: Well meaning and kindly. "She gave a benevolent smile."`}
        </pre>

        <textarea
          className="admin-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your words and meanings here…"
          rows={10}
        />

        <div className="admin-actions">
          <button type="button" className="btn primary" onClick={handleParse}>
            Parse text
          </button>
        </div>

        {entries.length > 0 && (
          <>
            <p className="admin-count">
              Parsed {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              {duplicates.length > 0 && (
                <span className="admin-warn">
                  {' '}
                  ({duplicates.length} already exist — will be added as extra
                  definitions)
                </span>
              )}
            </p>

            <div className="admin-table">
              <div className="admin-row head">
                <span>Word</span>
                <span>Part</span>
                <span>Definition</span>
                <span>Example</span>
                <span />
              </div>
              {entries.map((entry, i) => (
                <div className="admin-row" key={i}>
                  {FIELDS.map((field) => (
                    <input
                      key={field}
                      className={`field field-${field}`}
                      value={entry[field]}
                      placeholder={field === 'partOfSpeech' ? 'noun' : ''}
                      onChange={(e) => updateEntry(i, field, e.target.value)}
                    />
                  ))}
                  <button
                    type="button"
                    className="row-remove"
                    onClick={() => removeEntry(i)}
                    aria-label="Remove entry"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-actions">
              <button type="button" className="btn primary" onClick={download}>
                Download dictionary.json
              </button>
              <button type="button" className="btn" onClick={copy}>
                Copy JSON
              </button>
            </div>

            <p className="admin-note">
              Replace <code>src/data/dictionary.json</code> with the downloaded file,
              then commit and push to GitHub. Vercel redeploys automatically.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
