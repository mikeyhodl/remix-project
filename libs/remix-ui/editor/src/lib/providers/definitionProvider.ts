import { Monaco } from "@monaco-editor/react"
import monaco from "../../types/monaco"
import { EditorUIProps } from "../remix-ui-editor"

export class RemixDefinitionProvider implements monaco.languages.DefinitionProvider {
  props: EditorUIProps
  monaco: Monaco
  constructor(props: any, monaco: any) {
    this.props = props
    this.monaco = monaco
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async provideDefinition(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): Promise<monaco.languages.Definition | monaco.languages.LocationLink[]> {
    const cursorPosition = this.props.editorAPI.getCursorPosition()
    let jumpLocation = await this.jumpToDefinition(cursorPosition)
    if (!jumpLocation || !jumpLocation.fileName) {
      const line = model.getLineContent(position.lineNumber)
      const lastpart = line.substring(0, position.column - 1).split(';').pop()
      if (lastpart.startsWith('import')) {
        const importPath = line.substring(lastpart.indexOf('"') + 1)
        const importPath2 = importPath.substring(0, importPath.indexOf('"'))
        
        // Try to resolve using the resolution index
        // model.uri.path gives us the current file we're in
        const currentFile = model.uri.path
        console.log('[DefinitionProvider] 📍 Import navigation from:', currentFile, '→', importPath2)
        
        let resolvedPath = importPath2
        try {
          // Check if we have a resolution index entry for this import
          const resolved = await this.props.plugin.call('contentImport', 'resolveImportFromIndex', currentFile, importPath2)
          if (resolved) {
            console.log('[DefinitionProvider] ✅ Found in resolution index:', resolved)
            resolvedPath = resolved
          } else {
            console.log('[DefinitionProvider] ℹ️ Not in resolution index, using original path')
          }
        } catch (e) {
          console.log('[DefinitionProvider] ⚠️ Failed to lookup resolution index:', e)
        }
        
        jumpLocation = {
          startLineNumber: 1,
          startColumn: 1,
          endColumn: 1,
          endLineNumber: 1,
          fileName: resolvedPath
        }
      }
    }
    if (jumpLocation && jumpLocation.fileName) {
      return [{
        uri: this.monaco.Uri.parse(jumpLocation.fileName),
        range: {
          startLineNumber: jumpLocation.startLineNumber,
          startColumn: jumpLocation.startColumn,
          endLineNumber: jumpLocation.endLineNumber,
          endColumn: jumpLocation.endColumn
        }
      }]
    }
    return []
  }

  async jumpToDefinition(position: any) {
    const node = await this.props.plugin.call('codeParser', 'definitionAtPosition', position)
    const sourcePosition = await this.props.plugin.call('codeParser', 'positionOfDefinition', node)
    if (sourcePosition) {
      return await this.jumpToPosition(sourcePosition)
    }
  }

  /*
    * onClick jump to position of ast node in the editor
    */
  async jumpToPosition(position: any) {
    const jumpToLine = async (fileName: string, lineColumn: any) => {
      // Try to resolve the fileName using the resolution index
      // This is crucial for navigating to library files with correct versions
      let resolvedFileName = fileName
      try {
        const currentFile = await this.props.plugin.call('fileManager', 'file')
        const resolved = await this.props.plugin.call('contentImport', 'resolveImportFromIndex', currentFile, fileName)
        if (resolved) {
          console.log('[DefinitionProvider] 🔀 Resolved via index:', fileName, '→', resolved)
          resolvedFileName = resolved
        }
      } catch (e) {
        console.log('[DefinitionProvider] ⚠️ Resolution index lookup failed, using original path:', e)
      }
      
      const fileTarget = await this.props.plugin.call('fileManager', 'getPathFromUrl', resolvedFileName)
      console.log('jumpToLine', fileName, '→', resolvedFileName, '→', fileTarget)
      if (resolvedFileName !== await this.props.plugin.call('fileManager', 'file')) {
        await this.props.plugin.call('contentImport', 'resolveAndSave', resolvedFileName, null)
        const fileContent = await this.props.plugin.call('fileManager', 'readFile', resolvedFileName)
        try {
          await this.props.plugin.call('editor', 'addModel', fileTarget.file, fileContent)
        } catch (e) {

        }
      }
      if (lineColumn.start && lineColumn.start.line >= 0 && lineColumn.start.column >= 0) {
        const pos = {
          startLineNumber: lineColumn.start.line + 1,
          startColumn: lineColumn.start.column + 1,
          endColumn: lineColumn.end.column + 1,
          endLineNumber: lineColumn.end.line + 1,
          fileName: (fileTarget && fileTarget.file) || resolvedFileName
        }
        return pos
      }
    }
    const lastCompilationResult = await this.props.plugin.call('codeParser', 'getLastCompilationResult') // await this.props.plugin.call('compilerArtefacts', 'getLastCompilationResult')
    if (lastCompilationResult && lastCompilationResult.languageversion.indexOf('soljson') === 0 && lastCompilationResult.data) {

      const lineColumn = await this.props.plugin.call('codeParser', 'getLineColumnOfPosition', position)
      const filename = lastCompilationResult.getSourceName(position.file)
      return await jumpToLine(filename, lineColumn)
    }
  }
}