export interface IImportResolver {
  resolveAndSave(url: string): Promise<string>
  saveResolutionsToIndex(): Promise<void>
  getTargetFile(): string
}
