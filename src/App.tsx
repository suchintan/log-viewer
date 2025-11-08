import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { FiltersPanel } from './components/FiltersPanel'
import { LogTable } from './components/LogTable'
import { QueryConsole } from './components/QueryConsole'
import { SAMPLE_LOG_TEXT } from './data/sampleLogs'
import type { LogEntry } from './types'
import { parseLogText } from './utils/logParser'
import { formatDuration } from './utils/format'
import { buildFacetView } from './utils/facets'
import './App.css'

type SortDirection = 'asc' | 'desc'

interface Hotspot {
  current: LogEntry
  previous: LogEntry | null
  gapMs: number
}

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [skipped, setSkipped] = useState(0)
  const [activeSource, setActiveSource] = useState('No file loaded yet')

  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set())
  const [sourceFilterInitialized, setSourceFilterInitialized] = useState(false)
  const [metadataFilters, setMetadataFilters] = useState<Record<string, string[]>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [statusMessage, setStatusMessage] = useState('')
  const [gapThresholdSeconds, setGapThresholdSeconds] = useState(5)

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    logs.forEach((log) => {
      counts[log.level] = (counts[log.level] ?? 0) + 1
    })
    return counts
  }, [logs])

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    logs.forEach((log) => {
      const key = log.sourceFile || 'unknown'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return counts
  }, [logs])

  const metadataOptions = useMemo<Map<string, string[]>>(() => {
    const map = new Map<string, Set<string>>()
    logs.forEach((log) => {
      Object.entries(log.metadata).forEach(([key, value]) => {
        if (!map.has(key)) {
          map.set(key, new Set())
        }
        map.get(key)!.add(value)
      })
    })

    return new Map(Array.from(map.entries()).map(([key, values]) => [key, Array.from(values).sort()]))
  }, [logs])

  const filteredLogs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return logs.filter((log) => {
      if (levelFilter.size > 0 && !levelFilter.has(log.level)) {
        return false
      }

      const sourceLabel = log.sourceFile || 'unknown'
      if (sourceFilter.size > 0 && !sourceFilter.has(sourceLabel)) {
        return false
      }

      const metadataMatch = Object.entries(metadataFilters).every(([key, values]) => {
        if (values.length === 0) {
          return true
        }
        const rawValue = log.metadata[key]
        return rawValue ? values.includes(rawValue) : false
      })

      if (!metadataMatch) {
        return false
      }

      if (!search) {
        return true
      }

      const haystack = [
        log.message,
        log.sourceFile,
        log.raw,
        ...Object.entries(log.metadata).map(([key, value]) => `${key}=${value}`),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [logs, levelFilter, sourceFilter, metadataFilters, searchTerm])

  const sortedLogs = useMemo(() => {
    const snapshot = [...filteredLogs]
    snapshot.sort((a, b) => {
      const timeA = a.timestamp?.getTime() ?? 0
      const timeB = b.timestamp?.getTime() ?? 0
      if (sortDirection === 'asc') {
        return timeA - timeB
      }
      return timeB - timeA
    })
    return snapshot
  }, [filteredLogs, sortDirection])

  const { gapMap, chronologicalLogs } = useMemo(() => {
    if (filteredLogs.length === 0) {
      return { gapMap: new Map<string, number>(), chronologicalLogs: [] as LogEntry[] }
    }

    const chronological = [...filteredLogs].sort((a, b) => {
      const timeA = a.timestamp?.getTime() ?? 0
      const timeB = b.timestamp?.getTime() ?? 0
      return timeA - timeB
    })

    const map = new Map<string, number>()
    if (chronological.length > 0) {
      map.set(chronological[0].id, 0)
    }
    for (let i = 1; i < chronological.length; i += 1) {
      const prev = chronological[i - 1]
      const curr = chronological[i]
      const prevTime = prev.timestamp?.getTime()
      const currTime = curr.timestamp?.getTime()
      const delta = prevTime != null && currTime != null ? Math.max(currTime - prevTime, 0) : 0
      map.set(curr.id, delta)
    }

    return { gapMap: map, chronologicalLogs: chronological }
  }, [filteredLogs])

  const gapThresholdMs = Math.max(gapThresholdSeconds, 0) * 1000

  const hotspots = useMemo<Hotspot[]>(() => {
    if (chronologicalLogs.length < 2) {
      return []
    }
    const threshold = gapThresholdMs
    const entries: Hotspot[] = []
    for (let i = 1; i < chronologicalLogs.length; i += 1) {
      const current = chronologicalLogs[i]
      const previous = chronologicalLogs[i - 1]
      const gapMs = gapMap.get(current.id) ?? 0
      if (gapMs >= threshold && gapMs > 0) {
        entries.push({ current, previous, gapMs })
      }
    }
    entries.sort((a, b) => b.gapMs - a.gapMs)
    return entries.slice(0, 5)
  }, [chronologicalLogs, gapMap, gapThresholdMs])

  const { rows: facetRows, columns: facetColumns } = useMemo(() => buildFacetView(filteredLogs), [filteredLogs])

  const levelOptions = useMemo(
    () =>
      Object.entries(levelCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count, label: value.toUpperCase() })),
    [levelCounts],
  )

  const sourceOptions = useMemo(
    () =>
      Object.entries(sourceCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count })),
    [sourceCounts],
  )

  const allSourcesActive = sourceOptions.length > 0 && sourceFilter.size === sourceOptions.length

  useEffect(() => {
    if (sourceFilterInitialized) {
      return
    }
    if (sourceOptions.length === 0) {
      return
    }

    setSourceFilter(new Set(sourceOptions.map((option) => option.value)))
    setSourceFilterInitialized(true)
  }, [sourceOptions, sourceFilterInitialized])

  const isSourceFiltered = sourceOptions.length > 0 && sourceFilter.size > 0 && !allSourcesActive

  const hasActiveFilters =
    levelFilter.size > 0 ||
    isSourceFiltered ||
    Object.values(metadataFilters).some((values) => values.length > 0) ||
    Boolean(searchTerm)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    readFile(file)
    event.target.value = ''
  }

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setStatusMessage('Unsupported file encoding.')
        return
      }
      hydrate(reader.result, file.name)
    }
    reader.onerror = () => {
      setStatusMessage('Failed to read that file. Try again?')
    }
    reader.readAsText(file)
  }

  const hydrate = (content: string, label: string) => {
    const { entries, skipped: skippedLines } = parseLogText(content)
    setLogs(entries)
    setSkipped(skippedLines)
    setActiveSource(label)
    resetFilters()
    setStatusMessage(skippedLines ? `Loaded ${entries.length} lines. Skipped ${skippedLines}.` : `Loaded ${entries.length} lines.`)
  }

  const resetFilters = () => {
    setLevelFilter(new Set())
    setSourceFilter(new Set())
    setSourceFilterInitialized(false)
    setMetadataFilters({})
    setSearchTerm('')
  }

  const toggleLevel = (level: string) => {
    setLevelFilter((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }

  const toggleSource = (source: string) => {
    setSourceFilter((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }

  const selectAllSources = () => {
    setSourceFilter(new Set(sourceOptions.map((option) => option.value)))
  }

  const handleThresholdChange = (value: number) => {
    if (Number.isNaN(value)) {
      return
    }
    const clamped = Math.min(3600, Math.max(0.1, value))
    setGapThresholdSeconds(clamped)
  }

  const addMetadataFilter = (key: string, value: string) => {
    setMetadataFilters((prev) => {
      const existing = prev[key] ?? []
      if (existing.includes(value)) {
        return prev
      }

      return {
        ...prev,
        [key]: [...existing, value],
      }
    })
  }

  const removeMetadataFilter = (key: string, value: string) => {
    setMetadataFilters((prev) => {
      const nextValues = (prev[key] ?? []).filter((candidate) => candidate !== value)
      const next = { ...prev }
      if (nextValues.length === 0) {
        delete next[key]
      } else {
        next[key] = nextValues
      }
      return next
    })
  }

  const loadSample = () => {
    hydrate(SAMPLE_LOG_TEXT, 'Sample agent session')
  }

  const displayedCount = sortedLogs.length
  const totalCount = logs.length
  const thresholdDisabled = chronologicalLogs.length < 2

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Log Explorer</p>
          <h1>Understand agent runs without grepping</h1>
          <p className="muted">
            Drop in any plain-text log (or use the sample) and slice it by timestamp, level, source file, or any kwargs.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={loadSample}>
            Load sample logs
          </button>
        </div>
      </header>

      <section className="uploader-card">
        <label className="file-drop">
          <input type="file" accept=".log,.txt,.out,.json,text/plain" onChange={handleFileChange} />
          <span>Click to browse or drop a log file</span>
        </label>
        <div className="file-meta">
          <p>
            <strong>Showing:</strong> {activeSource}
          </p>
          <p>
            {totalCount} parsed line{totalCount === 1 ? '' : 's'}
            {skipped > 0 && ` • ${skipped} skipped`}
          </p>
          {statusMessage && <p className="muted">{statusMessage}</p>}
        </div>
      </section>

      <div className="content-grid">
        <FiltersPanel
          levelOptions={levelOptions}
          levelFilter={levelFilter}
          onToggleLevel={toggleLevel}
          sourceOptions={sourceOptions}
          sourceFilter={sourceFilter}
          onToggleSource={toggleSource}
          onSelectAllSources={selectAllSources}
          allSourcesActive={allSourcesActive}
          metadataOptions={metadataOptions}
          metadataFilters={metadataFilters}
          addMetadataFilter={addMetadataFilter}
          removeMetadataFilter={removeMetadataFilter}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClearAll={resetFilters}
          hasActiveFilter={hasActiveFilters}
        />

        <section className="log-view">
          <div className="log-toolbar">
            <div>
              <p className="muted">
                Showing {displayedCount} of {totalCount} line{totalCount === 1 ? '' : 's'}
              </p>
              {skipped > 0 && <p className="warning">Skipped {skipped} lines that did not match the parser.</p>}
            </div>
            <div className="toolbar-actions">
              <label className="sort-control">
                Sort by timestamp
                <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}>
                  <option value="desc">Newest → Oldest</option>
                  <option value="asc">Oldest → Newest</option>
                </select>
              </label>
            </div>
          </div>
          <div className="hotspot-panel">
            <div className="hotspot-header">
              <div>
                <p className="filter-label">Performance hotspots</p>
                <p className="muted">Flag the biggest gaps between consecutive log lines.</p>
              </div>
              <div className="threshold-controls">
                <label>
                  <span className="sr-only">Threshold in seconds</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={gapThresholdSeconds}
                    disabled={thresholdDisabled}
                    onChange={(event) => handleThresholdChange(Number(event.target.value))}
                  />
                  <span className="threshold-label">sec</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="30"
                  step="0.1"
                  value={gapThresholdSeconds}
                  disabled={thresholdDisabled}
                  onChange={(event) => handleThresholdChange(Number(event.target.value))}
                />
              </div>
            </div>
            {thresholdDisabled ? (
              <p className="muted">Load at least two log lines to analyze timing gaps.</p>
            ) : hotspots.length > 0 ? (
              <ul className="hotspot-list">
                {hotspots.map(({ current, previous, gapMs }) => (
                  <li key={current.id}>
                    <div className="hotspot-gap">{formatDuration(gapMs)}</div>
                    <div className="hotspot-details">
                      <p>
                        Between <span className="mono">{previous?.timestampRaw ?? 'start of file'}</span> and{' '}
                        <span className="mono">{current.timestampRaw}</span>
                      </p>
                      <p className="muted">
                        {(previous?.message || 'Start').slice(0, 80)}
                        {previous?.message && previous.message.length > 80 ? '…' : ''} →{' '}
                        {current.message.slice(0, 80)}
                        {current.message.length > 80 ? '…' : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No gaps longer than {formatDuration(gapThresholdMs)} in the current selection. Decrease the threshold to
                be more sensitive.
              </p>
            )}
          </div>
          <LogTable logs={sortedLogs} gapMap={gapMap} gapThresholdMs={gapThresholdMs} />
          <QueryConsole rows={facetRows} columns={facetColumns} />
        </section>
      </div>
    </div>
  )
}

export default LogViewer
