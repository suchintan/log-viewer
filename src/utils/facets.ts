import type { LogEntry } from '../types'

export interface FacetColumn {
  name: string
  label: string
  source: 'core' | 'metadata'
  originalKey?: string
  description?: string
}

interface FacetView {
  rows: Record<string, unknown>[]
  columns: FacetColumn[]
}

const CORE_COLUMNS: FacetColumn[] = [
  { name: 'id', label: 'id', source: 'core', description: 'Unique log line id (timestamp-index).' },
  { name: 'timestamp', label: 'timestamp', source: 'core', description: 'Original ISO8601 timestamp string.' },
  { name: 'timestamp_ms', label: 'timestamp_ms', source: 'core', description: 'Timestamp as milliseconds since epoch.' },
  { name: 'level', label: 'level', source: 'core', description: 'Normalized log level (debug/info/etc).' },
  { name: 'source_file', label: 'source_file', source: 'core', description: 'File path inside the brackets.' },
  { name: 'source_line', label: 'source_line', source: 'core', description: 'Line number extracted from source block.' },
  { name: 'message', label: 'message', source: 'core', description: 'Free-form message text before kwargs.' },
  { name: 'raw', label: 'raw', source: 'core', description: 'Entire unparsed log line.' },
]

export function buildFacetView(logs: LogEntry[]): FacetView {
  const metadataColumnMap = new Map<string, FacetColumn>()

  const ensureColumn = (originalKey: string): string => {
    const base = `meta_${sanitizeKey(originalKey)}`
    if (!metadataColumnMap.has(base)) {
      metadataColumnMap.set(base, {
        name: base,
        label: base,
        source: 'metadata',
        originalKey,
        description: `Metadata parsed from "${originalKey}".`,
      })
      return base
    }

    const existing = metadataColumnMap.get(base)
    if (existing?.originalKey === originalKey) {
      return base
    }

    let suffix = 2
    let candidate = `${base}_${suffix}`
    while (metadataColumnMap.has(candidate)) {
      suffix += 1
      candidate = `${base}_${suffix}`
    }

    metadataColumnMap.set(candidate, {
      name: candidate,
      label: candidate,
      source: 'metadata',
      originalKey,
      description: `Metadata parsed from "${originalKey}".`,
    })
    return candidate
  }

  const rows: Record<string, unknown>[] = logs.map((log) => {
    const row: Record<string, unknown> = {
      id: log.id,
      timestamp: log.timestampRaw,
      timestamp_ms: log.timestamp?.getTime() ?? null,
      level: log.level,
      source_file: log.sourceFile,
      source_line: log.sourceLine,
      message: log.message,
      raw: log.raw,
    }

    Object.entries(log.metadata).forEach(([key, value]) => {
      const columnName = ensureColumn(key)
      row[columnName] = coerceValue(value)
    })

    return row
  })

  const columns = [...CORE_COLUMNS, ...metadataColumnMap.values()]
  return { rows, columns }
}

function sanitizeKey(key: string): string {
  const replaced = key.replace(/[^A-Za-z0-9_]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '')
  const trimmed = replaced || 'field'
  if (/^[0-9]/.test(trimmed)) {
    return `f_${trimmed}`
  }
  return trimmed.toLowerCase()
}

function coerceValue(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'null') {
    return null
  }

  if (trimmed.toLowerCase() === 'true') {
    return true
  }
  if (trimmed.toLowerCase() === 'false') {
    return false
  }

  const numberValue = Number(trimmed)
  if (Number.isFinite(numberValue)) {
    return numberValue
  }

  return value
}
