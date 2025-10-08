/**
 * Interface for import resolution
 * Allows the Compiler to remain agnostic about how imports are resolved
 */
export interface IImportResolver {
  /**
   * Resolve an import path and return its content
   * @param url - The import path to resolve
   * @returns Promise resolving to the file content
   */
  resolveAndSave(url: string): Promise<string>
  
  /**
   * Save the current compilation's resolutions to persistent storage
   * Called after successful compilation
   */
  saveResolutionsToIndex(): Promise<void>
  
  /**
   * Get the target file for this compilation
   */
  getTargetFile(): string
}
