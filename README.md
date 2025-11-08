# Log Viewer

Turn raw plain-text logs into an interactive React workspace with zero wiring. Log Viewer ships as a single component that bundles ingestion, filtering, hotspot detection, and ad-hoc SQL queries so product teams can drop observability tooling anywhere in the UI.

## Features

- Drag-and-drop upload for `.log`, `.txt`, `.json`, or any UTF‑8 text file
- Snapshot of log levels, sources, and metadata facets with inline filters
- Hotspot detector to highlight large gaps between consecutive entries
- AlaSQL-powered query console for ad-hoc SQL over the filtered dataset
- TypeScript definitions, tree-shakeable ESM build, and UMD fallback for legacy setups

## Requirements

- React 18.2+ or 19.x
- React DOM 18.2+ or 19.x
- Any bundler that understands ES modules (Vite, Next.js, CRA, etc.)

## Installation

```bash
npm install @suchintan/log-viewer
# or
yarn add @suchintan/log-viewer
```

You’ll usually want to import the prebuilt stylesheet as well:

```ts
import '@suchintan/log-viewer/dist/style.css'
```

## Quick Start

1. Install the dependency and CSS bundle (see above).
2. Render the component anywhere inside your React tree.
3. Drop a log file, or click “Load sample logs” to explore the demo dataset.

```tsx
import '@suchintan/log-viewer/dist/style.css'
import { LogViewer } from '@suchintan/log-viewer'

export function ObservabilityTab() {
  return (
    <section style={{ minHeight: '90vh', background: '#020617' }}>
      <LogViewer />
    </section>
  )
}
```

That’s it—Log Viewer handles ingestion, filtering state, and presentation out of the box.

## Log Format

The built-in parser (see `src/utils/logParser.ts`) expects log lines shaped like:

```
2024-04-12T05:41:11.337Z [info] [agents/tools.py:71] tool_call status=ok latency_ms=212 name=calculator
└──────────── timestamp ─────┘ └ lvl ┘ └─ source:file:line ─────┘ └──── payload / metadata pairs ─────┘
```

Metadata is pulled from `key=value` pairs; nested braces/brackets/parens are supported so JSON blobs stay intact. Lines that do not match the regex are skipped but the UI reports how many were dropped.

The exported `LogEntry` type describes the normalized schema if you need to interop with your own tooling:

```ts
import type { LogEntry } from '@suchintan/log-viewer'
```

> Want to ingest a different format? Fork `parseLogText` or wrap Log Viewer in your own component that primes its internal state with a new dataset. Library hooks for custom feeds are on the roadmap.

## Styling & Theming

- The CSS bundle is intentionally minimal—override any class from `src/App.css` via your own stylesheet to match brand colors.
- The layout uses CSS grid/flexbox and sticks the filters panel on the left; wrap `<LogViewer />` in a container with your desired width/background.

## Local Development

```bash
npm install
npm run dev        # Vite dev server with the playground UI
npm run lint       # ESLint
npm run typecheck  # Project references
npm run build      # Library bundle + type declarations
```

`npm run build` emits:

- `dist/log-viewer.js` (ES module bundle)
- `dist/log-viewer.umd.cjs` (UMD bundle)
- `dist/log-viewer.css`
- `dist/types` (TypeScript declarations)

Use `npm pack` to inspect the exact tarball before publishing.

## Publishing

1. Bump the version: `npm version <patch|minor|major>`
2. Build & lint: `npm run lint && npm run typecheck && npm run build`
3. Sanity-check the archive: `npm pack`
4. Log in once: `npm login`
5. Publish: `npm publish --access public`

Each release simply repeats the checklist with a higher semver tag.
