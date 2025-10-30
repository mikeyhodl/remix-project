// A minimal IO adapter interface to decouple resolver logic from Remix plugin APIs.
// Implementations can target Remix (Plugin API), Node (fs/fetch), or tests (in-memory).

export interface IOAdapter {
  // Filesystem-like operations
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  setFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>

  // Network/content retrieval
  fetch(url: string): Promise<string>

  // Optional optimized path which both fetches and persists according to the adapter rules.
  // If not implemented, callers can fall back to fetch() + setFile().
  resolveAndSave?(url: string, targetPath?: string, useOriginal?: boolean): Promise<string>

  // Optional cache toggle. Adapters that implement internal caching behavior
  // (e.g., skip fetch if destination exists) should honor this flag.
  setCacheEnabled?(enabled: boolean): void
}
