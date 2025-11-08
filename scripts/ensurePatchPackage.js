#!/usr/bin/env node
/**
 * Some upstream dependencies (like Rollup) expect a `patch-package` binary to exist
 * when npm install scripts run. This repo does not rely on patch-package, but the
 * missing binary causes installs to fail in certain environments. We pre-create a
 * tiny no-op executable so the install succeeds everywhere.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const binDir = join(process.cwd(), 'node_modules', '.bin')
const patchExecutable = join(binDir, 'patch-package')

mkdirSync(binDir, { recursive: true })

if (!existsSync(patchExecutable)) {
  writeFileSync(
    patchExecutable,
    `#!/usr/bin/env bash
exit 0
`,
    { mode: 0o755 },
  )

  // Ensure executable bit is present even if the file already existed but was missing perms
  chmodSync(patchExecutable, 0o755)
}
