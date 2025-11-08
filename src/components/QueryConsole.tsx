import { useEffect, useMemo, useState } from 'react'
import alasql from 'alasql'
import type { FacetColumn } from '../utils/facets'

const DEFAULT_QUERY = `SELECT level, COUNT(*) AS count
FROM ?
GROUP BY level
ORDER BY count DESC`

const SAMPLE_QUERIES = [
  {
    label: 'Top log levels',
    sql: DEFAULT_QUERY,
  },
  {
    label: 'Prompt duration',
    sql: `SELECT meta_prompt_name AS prompt, SUM(meta_duration_seconds) AS total_seconds, COUNT(*) AS hits
FROM ?
WHERE meta_prompt_name IS NOT NULL
GROUP BY prompt
ORDER BY total_seconds DESC`,
  },
  {
    label: 'Slow gaps (>5s)',
    sql: `SELECT timestamp, level, message
FROM ?
WHERE timestamp_ms IS NOT NULL
ORDER BY timestamp_ms DESC
LIMIT 10`,
  },
]

interface QueryConsoleProps {
  rows: Record<string, unknown>[]
  columns: FacetColumn[]
}

export function QueryConsole({ rows, columns }: QueryConsoleProps) {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastExecuted, setLastExecuted] = useState<string>('')

  const disabled = rows.length === 0

  const runQuery = (sql?: string) => {
    if (disabled) {
      return
    }
    const statement = (sql ?? query).trim()
    if (!statement) {
      setError('Enter a SQL statement that references the dataset with `?`.')
      return
    }

    try {
      const output = alasql(statement, [rows])
      const normalized = Array.isArray(output) ? output : [output]
      setResults(normalized as Record<string, unknown>[])
      setError(null)
      setLastExecuted(statement)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    if (disabled) {
      setResults([])
      setError(null)
      setLastExecuted('')
      return
    }

    if (lastExecuted) {
      runQuery(lastExecuted)
    } else {
      runQuery(DEFAULT_QUERY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const resultColumns = useMemo(() => {
    if (results.length === 0) {
      return []
    }
    const set = new Set<string>()
    results.forEach((row) => {
      Object.keys(row).forEach((key) => set.add(key))
    })
    return Array.from(set)
  }, [results])

  return (
    <section className="query-console">
      <div className="console-header">
        <div>
          <p className="eyebrow">Facet SQL</p>
          <h2>Ask ad-hoc questions</h2>
          <p className="muted">The current log selection is exposed as table `?`. Use regular SQL to aggregate fields.</p>
        </div>
        <div className="console-actions">
          <button type="button" onClick={() => runQuery()} disabled={disabled}>
            Run query
          </button>
        </div>
      </div>

      <div className="sample-queries">
        {SAMPLE_QUERIES.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => {
              setQuery(sample.sql)
              runQuery(sample.sql)
            }}
            disabled={disabled}
          >
            {sample.label}
          </button>
        ))}
      </div>

      <textarea
        className="query-input"
        rows={5}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="SELECT * FROM ? LIMIT 10"
        disabled={disabled}
      />
      {error && <p className="error-text">{error}</p>}

      <div className="console-body">
        <div className="schema-panel">
          <p className="filter-label">Columns</p>
          <ul>
            {columns.map((column) => (
              <li key={column.name}>
                <code>{column.name}</code>
                <span className="muted">
                  {column.description}
                  {column.originalKey && column.source === 'metadata' && ` (source: ${column.originalKey})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="results-panel">
          <p className="filter-label">Results</p>
          {disabled ? (
            <p className="muted">Load some logs to run a query.</p>
          ) : results.length === 0 ? (
            <p className="muted">Run a query to see results.</p>
          ) : (
            <div className="results-table">
              <table>
                <thead>
                  <tr>
                    {resultColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, index) => (
                    <tr key={index}>
                      {resultColumns.map((column) => (
                        <td key={column}>{formatValue(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(3)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return String(value)
}
