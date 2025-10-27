// Lightweight shim to avoid duplicating implementation while preventing TS from traversing cross-project sources
// Tries the package name first; during local ts-node tests, fall back to monorepo source path
// eslint-disable-next-line @typescript-eslint/no-var-requires
let Imported: any
try {
	Imported = require('@remix-project/import-resolver')
} catch (e) {
	try {
		// When running tests with ts-node, the path alias may not be respected by Node's require
		// Resolve the local package source directly
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		Imported = require('../../../remix-import-resolver/src')
	} catch (e2) {
		// Re-throw original error to preserve context
		throw e
	}
}
export const ImportResolver = Imported.ImportResolver as any
