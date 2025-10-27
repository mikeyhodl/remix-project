
// Lightweight shim to avoid duplicating implementation while preventing TS from traversing cross-project sources
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Imported = require('@remix-project/import-resolver')
export const ImportResolver = Imported.ImportResolver as any
