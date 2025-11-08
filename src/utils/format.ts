export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '—'
  }

  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000)
    const seconds = Math.round((ms % 60_000) / 1000)
    if (seconds === 60) {
      return `${minutes + 1}m`
    }
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
  }

  if (ms >= 1000) {
    const seconds = ms / 1000
    return `${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)}s`
  }

  return `${Math.round(ms)}ms`
}
