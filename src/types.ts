export interface LogEntry {
  id: string
  raw: string
  timestampRaw: string
  timestamp: Date | null
  level: string
  sourceFile: string
  sourceLine: number | null
  message: string
  metadata: Record<string, string>
}

export interface ParseResult {
  entries: LogEntry[]
  skipped: number
}
