import type { LogEntry } from '../types'
import { formatDuration } from '../utils/format'

interface LogTableProps {
  logs: LogEntry[]
  gapMap: Map<string, number>
  gapThresholdMs: number
}

const formatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function LogTable({ logs, gapMap, gapThresholdMs }: LogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="log-table empty">
        <p>No log lines match the current filters.</p>
        <p className="muted">Try adjusting the filters or load a different file.</p>
      </div>
    )
  }

  return (
    <div className="log-table">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Level</th>
            <th>Source</th>
            <th>Message & kwargs</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const levelLabel = log.level.toUpperCase()
            const levelClass = log.level.replace(/\s+/g, '-')
            const gapMs = gapMap.get(log.id) ?? 0
            const isHotspot = gapMs >= gapThresholdMs && gapMs > 0
            return (
              <tr key={log.id} className={isHotspot ? 'hotspot-row' : undefined}>
                <td>
                  <div className="timestamp">{log.timestamp ? formatter.format(log.timestamp) : log.timestampRaw}</div>
                  <div className="muted mono">{log.timestampRaw}</div>
                </td>
                <td>
                  <span className={`level-badge level-${levelClass}`}>{levelLabel}</span>
                </td>
                <td>
                  <div className="source-file">{log.sourceFile || 'unknown'}</div>
                  <div className="muted">:{log.sourceLine ?? '—'}</div>
                </td>
                <td>
                  <p className="message">{log.message || '—'}</p>
                  {isHotspot && (
                    <div className="gap-pill">
                      <span>Gap since previous log: {formatDuration(gapMs)}</span>
                    </div>
                  )}
                  {Object.keys(log.metadata).length > 0 && (
                    <div className="metadata-grid">
                      {Object.entries(log.metadata).map(([key, value]) => (
                        <span className="chip" key={`${log.id}-${key}-${value}`}>
                          <strong>{key}</strong>
                          <span>=</span>
                          <span>{value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <details>
                    <summary>Raw line</summary>
                    <code className="raw-line">{log.raw}</code>
                  </details>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
