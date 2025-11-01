/**
 * Example: Integrating Import Handlers in Remix IDE
 * 
 * This shows how the new import-resolver with handler system
 * would be used in the Remix IDE compiler-content-imports plugin
 */

import { Plugin } from '@remixproject/engine'
import { ImportResolver, RemixTestLibsHandler } from '@remix-project/remix-import-resolver'

/**
 * OPTION 1: Auto-register default handlers (Recommended for Remix IDE)
 */
export class CompilerImportsAutomatic extends Plugin {
  private resolvers: Map<string, ImportResolver> = new Map()
  
  private async getResolver(targetFile: string): Promise<ImportResolver> {
    if (!this.resolvers.has(targetFile)) {
      // Simply pass registerDefaultHandlers: true to enable RemixTestLibsHandler
      const resolver = new ImportResolver(this, targetFile, this.debug, {
        registerDefaultHandlers: true
      })
      this.resolvers.set(targetFile, resolver)
    }
    return this.resolvers.get(targetFile)!
  }
  
  async resolveAndSave(url: string, targetPath?: string): Promise<string> {
    const currentFile = await this.call('fileManager', 'file')
    const resolver = await this.getResolver(currentFile)
    return resolver.resolveAndSave(url, targetPath)
  }
}

/**
 * OPTION 2: Manually register handlers (More control)
 */
export class CompilerImportsManual extends Plugin {
  private resolvers: Map<string, ImportResolver> = new Map()
  
  /**
   * Get or create a resolver for a specific file
   */
  private async getResolver(targetFile: string): Promise<ImportResolver> {
    if (!this.resolvers.has(targetFile)) {
      const resolver = new ImportResolver(this, targetFile, this.debug)
      
      // Register the Remix test libs handler
      const testLibsHandler = new RemixTestLibsHandler({
        pluginApi: this,
        io: (resolver as any).io, // Access internal IO adapter
        debug: this.debug
      })
      resolver.getHandlerRegistry().register(testLibsHandler)
      
      // You could register additional custom handlers here
      // resolver.getHandlerRegistry().register(new MyCustomHandler())
      
      this.resolvers.set(targetFile, resolver)
    }
    return this.resolvers.get(targetFile)!
  }
  
  /**
   * Resolve and save an import
   * This replaces the old hardcoded logic
   */
  async resolveAndSave(url: string, targetPath?: string): Promise<string> {
    // Get current file being compiled
    const currentFile = await this.call('fileManager', 'file')
    
    // Get or create resolver for this file
    const resolver = await this.getResolver(currentFile)
    
    // Resolve the import - handlers will automatically intercept special imports
    return resolver.resolveAndSave(url, targetPath)
  }
  
  /**
   * Clear resolvers when workspace changes
   */
  onWorkspaceChange(): void {
    this.resolvers.clear()
  }
}

/**
 * Example: Custom handler for your project
 */
import { ImportHandler, ImportHandlerContext, ImportHandlerResult } from '@remix-project/remix-import-resolver'

class ProjectSpecificHandler extends ImportHandler {
  constructor() {
    // Match imports from your custom namespace
    super(/^@myproject\/.*\.sol$/)
  }
  
  getPriority(): number {
    return 60 // Medium-high priority
  }
  
  async handle(context: ImportHandlerContext): Promise<ImportHandlerResult> {
    // Your custom logic here
    const { importPath, targetFile } = context
    
    // Example: Fetch from custom source or generate
    const content = await this.fetchFromCustomSource(importPath)
    
    return {
      handled: true,
      content,
      resolvedPath: `.deps/myproject/${importPath}`
    }
  }
  
  private async fetchFromCustomSource(path: string): Promise<string> {
    // Your implementation
    return `// Content for ${path}`
  }
}

/**
 * Example: Using handlers in tests
 */
describe('Compiler Imports with Handlers', () => {
  it('should handle remix_tests.sol automatically', async () => {
    const plugin = new CompilerImports()
    
    // This will automatically trigger RemixTestLibsHandler
    const content = await plugin.resolveAndSave('remix_tests.sol')
    
    expect(content).toContain('library Assert')
    expect(content).toContain('AssertionEvent')
  })
  
  it('should handle custom project imports', async () => {
    const plugin = new CompilerImports()
    const resolver = await (plugin as any).getResolver('contracts/MyContract.sol')
    
    // Register custom handler
    resolver.getHandlerRegistry().register(new ProjectSpecificHandler())
    
    // This will trigger ProjectSpecificHandler
    const content = await plugin.resolveAndSave('@myproject/utils/Helper.sol')
    
    expect(content).toContain('Content for @myproject/utils/Helper.sol')
  })
})
