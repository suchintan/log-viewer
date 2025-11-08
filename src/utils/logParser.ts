import type { LogEntry, ParseResult } from '../types'

const LOG_LINE_REGEX =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/

const KEY_CHAR_REGEX = /[A-Za-z0-9_.-]/

export function parseLogText(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/)
  const entries: LogEntry[] = []
  let skipped = 0

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    const parsed = parseLine(trimmed, index)
    if (parsed) {
      entries.push(parsed)
    } else {
      skipped += 1
    }
  })

  return { entries, skipped }
}

function parseLine(line: string, index: number): LogEntry | null {
  const match = line.match(LOG_LINE_REGEX)
  if (!match) {
    return null
  }

  const [, timestampRaw, levelRaw, locationRaw, payload] = match
  const timestamp = parseTimestamp(timestampRaw)
  const { sourceFile, sourceLine } = parseLocation(locationRaw)
  const { message, metadata } = splitPayload(payload)

  return {
    id: `${timestampRaw}-${index}`,
    raw: line,
    timestampRaw,
    timestamp,
    level: levelRaw.trim().toLowerCase(),
    sourceFile,
    sourceLine,
    message,
    metadata,
  }
}

function parseTimestamp(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseLocation(block: string): { sourceFile: string; sourceLine: number | null } {
  const colonIndex = block.lastIndexOf(':')
  if (colonIndex === -1) {
    return { sourceFile: block.trim(), sourceLine: null }
  }

  const filePart = block.slice(0, colonIndex).trim()
  const linePart = block.slice(colonIndex + 1).replace(/\D/g, '')
  return {
    sourceFile: filePart,
    sourceLine: linePart ? Number(linePart) : null,
  }
}

function splitPayload(payload: string): { message: string; metadata: Record<string, string> } {
  if (!payload) {
    return { message: '', metadata: {} }
  }

  const metadataStart = findMetadataStart(payload)
  if (metadataStart === -1) {
    return { message: payload.trim(), metadata: {} }
  }

  const message = payload.slice(0, metadataStart).trimEnd()
  const metadataBlock = payload.slice(metadataStart).trim()
  return { message, metadata: parseMetadata(metadataBlock) }
}

function findMetadataStart(payload: string): number {
  if (isKeyAhead(payload, 0)) {
    return 0
  }

  for (let i = 0; i < payload.length - 1; i++) {
    if (payload[i] !== ' ' || payload[i + 1] !== ' ') {
      continue
    }

    let j = i
    while (j < payload.length && payload[j] === ' ') {
      j++
    }

    if (isKeyAhead(payload, j)) {
      return j
    }
  }

  // If the message is immediately followed by a key (single space), catch that too.
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] !== ' ') {
      continue
    }

    let j = i
    while (j < payload.length && payload[j] === ' ') {
      j++
    }

    if (isKeyAhead(payload, j)) {
      return j
    }
  }

  return -1
}

function parseMetadata(block: string): Record<string, string> {
  const metadata: Record<string, string> = {}
  const length = block.length
  let index = 0

  while (index < length) {
    while (index < length && block[index] === ' ') {
      index++
    }

    const keyStart = index
    while (index < length && KEY_CHAR_REGEX.test(block[index])) {
      index++
    }

    if (index >= length || block[index] !== '=') {
      break
    }

    const key = block.slice(keyStart, index)
    index += 1 // skip '='

    const { value, nextIndex } = readValue(block, index)
    metadata[key] = value.trim()
    index = nextIndex
  }

  return metadata
}

function readValue(block: string, startIndex: number): { value: string; nextIndex: number } {
  let index = startIndex
  const length = block.length
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0

  while (index < length) {
    const char = block[index]
    if (char === '(') depthParen++
    else if (char === ')' && depthParen > 0) depthParen--
    else if (char === '[') depthBracket++
    else if (char === ']' && depthBracket > 0) depthBracket--
    else if (char === '{') depthBrace++
    else if (char === '}' && depthBrace > 0) depthBrace--

    if (
      char === ' ' &&
      depthParen === 0 &&
      depthBracket === 0 &&
      depthBrace === 0 &&
      isKeyAhead(block, index + 1)
    ) {
      break
    }

    index++
  }

  return { value: block.slice(startIndex, index).trimEnd(), nextIndex: index }
}

function isKeyAhead(block: string, start: number): boolean {
  let index = start
  while (index < block.length && block[index] === ' ') {
    index++
  }

  const keyStart = index
  while (index < block.length && KEY_CHAR_REGEX.test(block[index])) {
    index++
  }

  return keyStart < block.length && index < block.length && block[index] === '='
}
