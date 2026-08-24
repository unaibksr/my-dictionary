import { useState } from 'react'
import { parseEntries } from './parseDictionary.js'
import { getMergedDictionary, saveEntries } from './dictionaryStore.js'

const REPO = 'unaibksr/my-dictionary'
const FILE_PATH = 'src/data/dictionary.json'
const FIELDS = ['word', 'partOfSpeech', 'definition', 'example']

function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin)
}

function mergeEntries(current, additions) {
  const map = new Map()
  for (const e of current) map.set(e.word.trim().toLowerCase(), e)
  for (const a of additions) {
    if (!a.word || !a.definition) continue
    map.set(a.word.trim().toLowerCase(), {
      word: a.word,
      partOfSpeech: a.partOfSpeech,
      definition: a.definition,
      example: a.example,
    })
  }
  return [...map.values()]
}

export default function Admin({ onBack }) {
  const [text, setText] = useState('')
  const [entries, setEntries] = useState([])
  const [token, setToken] = useState(() => sessionStorage.getItem('gh-token') || '')
  const [savedMsg, setSavedMsg] = useState('')

  const existing = new Set(getMergedDictionary().map((e) => e.word.trim().toLowerCase()))

  const updateToken = (value) => {
    setToken(value)
    if (value) sessionStorage.setItem('gh-token', value)
    else sessionStorage.removeItem('gh-token')
  }

  const handleParse = () => {
    setEntries(parseEntries(text))
  }

  const updateEntry = (i, field, value) => {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))
  }

  const removeEntry = (i) => {
    setEntries((es) => es.filter((_, idx) => idx !== i))
  }

  const download = () => {
    const json = JSON.stringify([...getMergedDictionary(), ...entries], null, 2) + '\n'
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dictionary.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    const json = JSON.stringify([...getMergedDictionary(), ...entries], null, 2) + '\n'
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      window.prompt('Copy the JSON below:', json)
    }
  }

  const pushToGitHub = async (arr) => {
    const api = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    }
    const get = await fetch(api, { headers })
    if (!get.ok) throw new Error(`read failed (${get.status})`)
    const data = await get.json()
    const current = JSON.parse(atob(data.content))
    const merged = mergeEntries(current, arr)
    const put = await fetch(api, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update dictionary from admin panel',
        content: toBase64(JSON.stringify(merged, null, 2) + '\n'),
        sha: data.sha,
        branch: 'main',
      }),
    })
    if (!put.ok) throw new Error(`write failed (${put.status})`)
  }

  const handleSave = async () => {
    if (!entries.length) return
    const added = saveEntries(entries)
    if (!token) {
      setSavedMsg(
        added > 0
          ? `Saved ${added} word${added === 1 ? '' : 's'} to this browser. Add a GitHub token to also update the repo file.`
          : 'No new words to save. Add a GitHub token to update the repo file.',
      )
      return
    }
    try {
      await pushToGitHub([...getMergedDictionary(), ...entries])
      setSavedMsg('Updated dictionary.json on GitHub — Vercel will redeploy shortly.')
    } catch (e) {
      setSavedMsg(`Saved to browser, but GitHub update failed: ${e.message}`)
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
        <label className="admin-token">
          GitHub token (repo scope, stored only in this session)
          <input
            type="password"
            value={token}
            onChange={(e) => updateToken(e.target.value)}
            placeholder="ghp_… or fine-grained token with contents:write"
            autoComplete="off"
          />
        </label>

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
          <button type="button" className="btn" onClick={handleParse}>
            Parse text
          </button>
          <button type="button" className="btn primary" onClick={handleSave} disabled={!entries.length}>
            Save to dictionary.json
          </button>
        </div>

        {savedMsg && <p className="admin-count">{savedMsg}</p>}

        {entries.length > 0 && (
          <>
            <p className="admin-count">
              Parsed {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              {existing.size > 0 && entries.some((e) => existing.has(e.word.trim().toLowerCase())) && (
                <span className="admin-warn"> (some already exist — will be overwritten)</span>
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
              <button type="button" className="btn" onClick={download}>
                Download dictionary.json
              </button>
              <button type="button" className="btn" onClick={copy}>
                Copy JSON
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
