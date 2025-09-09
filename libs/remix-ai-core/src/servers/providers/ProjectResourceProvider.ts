/**
 * Project Resource Provider - Provides access to project files and metadata
 */

import { ICustomRemixApi } from '@remix-api';
import { MCPResource, MCPResourceContent } from '../../types/mcp';
import { BaseResourceProvider } from '../registry/RemixResourceProviderRegistry';
import { ResourceCategory } from '../types/mcpResources';

export class ProjectResourceProvider extends BaseResourceProvider {
  name = 'project';
  description = 'Provides access to project files, structure, and metadata';

  async getResources(remixApi: ICustomRemixApi): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

    try {
      // Get workspace root
      const workspacePath = await this.getWorkspacePath(remixApi);
      
      // Get project structure
      await this.collectProjectResources(remixApi, workspacePath, resources);
      
      // Add project metadata resources
      resources.push(
        this.createResource(
          'project://structure',
          'Project Structure',
          'Hierarchical view of project files and folders',
          'application/json',
          { 
            category: ResourceCategory.PROJECT,
            tags: ['structure', 'files', 'folders'],
            priority: 8
          }
        )
      );

      resources.push(
        this.createResource(
          'project://config',
          'Project Configuration',
          'Project configuration files and settings',
          'application/json',
          {
            category: ResourceCategory.PROJECT,
            tags: ['config', 'settings'],
            priority: 7
          }
        )
      );

      resources.push(
        this.createResource(
          'project://dependencies',
          'Project Dependencies',
          'Package dependencies and imports',
          'application/json',
          {
            category: ResourceCategory.PROJECT,
            tags: ['dependencies', 'packages', 'imports'],
            priority: 6
          }
        )
      );

    } catch (error) {
      console.warn('Failed to get project resources:', error);
    }

    return resources;
  }

  async getResourceContent(uri: string, remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    if (uri.startsWith('project://structure')) {
      return this.getProjectStructure(remixApi);
    }

    if (uri.startsWith('project://config')) {
      return this.getProjectConfig(remixApi);
    }

    if (uri.startsWith('project://dependencies')) {
      return this.getProjectDependencies(remixApi);
    }

    if (uri.startsWith('file://')) {
      return this.getFileContent(uri, remixApi);
    }

    throw new Error(`Unsupported resource URI: ${uri}`);
  }

  canHandle(uri: string): boolean {
    return uri.startsWith('project://') || uri.startsWith('file://');
  }

  private async collectProjectResources(
    remixApi: ICustomRemixApi, 
    path: string, 
    resources: MCPResource[], 
    visited: Set<string> = new Set()
  ): Promise<void> {
    if (visited.has(path) || path.includes('node_modules') || path.includes('.git')) {
      return;
    }
    visited.add(path);

    try {
      const exists = await remixApi.fileManager.exists(path);
      if (!exists) return;

      const isDir = await remixApi.fileManager.isDirectory(path);
      
      if (isDir) {
        // Process directory
        const files = await remixApi.fileManager.readdir(path);
        for (const file of files) {
          const fullPath = `${path}/${file}`;
          await this.collectProjectResources(remixApi, fullPath, resources, visited);
        }
      } else {
        // Process file
        const fileExtension = path.split('.').pop()?.toLowerCase() || '';
        const mimeType = this.getMimeTypeForFile(fileExtension);
        const category = this.getCategoryForFile(fileExtension);
        
        if (this.shouldIncludeFile(path, fileExtension)) {
          resources.push(
            this.createResource(
              `file://${path}`,
              path.split('/').pop() || path,
              `Source file: ${path}`,
              mimeType,
              {
                category,
                tags: this.getTagsForFile(path, fileExtension),
                fileExtension,
                size: await this.getFileSize(remixApi, path),
                lastModified: new Date().toISOString()
              }
            )
          );
        }
      }
    } catch (error) {
      console.warn(`Failed to process path ${path}:`, error);
    }
  }

  private async getProjectStructure(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      const workspacePath = await this.getWorkspacePath(remixApi);
      const structure = await this.buildDirectoryTree(remixApi, workspacePath);

      return this.createJsonContent('project://structure', {
        root: workspacePath,
        structure,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      return this.createTextContent('project://structure', `Error building project structure: ${error.message}`);
    }
  }

  private async getProjectConfig(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      const configs: any = {};
      
      // Check for common config files
      const configFiles = [
        'package.json',
        'hardhat.config.js',
        'hardhat.config.ts',
        'truffle-config.js',
        'remix.config.js',
        'foundry.toml',
        '.solhint.json',
        'slither.config.json'
      ];

      for (const configFile of configFiles) {
        try {
          const exists = await remixApi.fileManager.exists(configFile);
          if (exists) {
            const content = await remixApi.fileManager.readFile(configFile);
            configs[configFile] = this.parseConfig(configFile, content);
          }
        } catch (error) {
          configs[configFile] = { error: error.message };
        }
      }

      return this.createJsonContent('project://config', {
        configs,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      return this.createTextContent('project://config', `Error getting project config: ${error.message}`);
    }
  }

  private async getProjectDependencies(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      const dependencies: any = {
        npm: {},
        imports: [],
        contracts: []
      };

      // Get npm dependencies from package.json
      try {
        const packageExists = await remixApi.fileManager.exists('package.json');
        if (packageExists) {
          const packageContent = await remixApi.fileManager.readFile('package.json');
          const packageJson = JSON.parse(packageContent);
          dependencies.npm = {
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            peerDependencies: packageJson.peerDependencies || {}
          };
        }
      } catch (error) {
        dependencies.npm.error = error.message;
      }

      // Scan for Solidity imports
      await this.scanForImports(remixApi, '', dependencies);

      return this.createJsonContent('project://dependencies', {
        ...dependencies,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      return this.createTextContent('project://dependencies', `Error getting dependencies: ${error.message}`);
    }
  }

  private async getFileContent(uri: string, remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    const filePath = uri.replace('file://', '');
    
    try {
      const exists = await remixApi.fileManager.exists(filePath);
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = await remixApi.fileManager.readFile(filePath);
      const extension = filePath.split('.').pop()?.toLowerCase() || '';
      const mimeType = this.getMimeTypeForFile(extension);

      return {
        uri,
        mimeType,
        text: content
      };
    } catch (error) {
      return this.createTextContent(uri, `Error reading file: ${error.message}`);
    }
  }

  private async buildDirectoryTree(remixApi: ICustomRemixApi, path: string, maxDepth = 10): Promise<any> {
    if (maxDepth <= 0) return { name: '...', type: 'truncated' };

    try {
      const exists = await remixApi.fileManager.exists(path);
      if (!exists) return null;

      const name = path.split('/').pop() || path;
      const isDir = await remixApi.fileManager.isDirectory(path);

      if (isDir) {
        const children = [];
        try {
          const files = await remixApi.fileManager.readdir(path);
          for (const file of files.slice(0, 100)) { // Limit to prevent memory issues
            const fullPath = `${path}/${file}`;
            if (!file.startsWith('.') && !file.includes('node_modules')) {
              const child = await this.buildDirectoryTree(remixApi, fullPath, maxDepth - 1);
              if (child) children.push(child);
            }
          }
        } catch (error) {
          children.push({ name: 'error', type: 'error', message: error.message });
        }

        return {
          name,
          type: 'directory',
          path,
          children: children.sort((a, b) => {
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          })
        };
      } else {
        const extension = path.split('.').pop()?.toLowerCase() || '';
        return {
          name,
          type: 'file',
          path,
          extension,
          size: await this.getFileSize(remixApi, path)
        };
      }
    } catch (error) {
      return { name, type: 'error', path, message: error.message };
    }
  }

  private async scanForImports(remixApi: ICustomRemixApi, path: string, dependencies: any): Promise<void> {
    try {
      const exists = await remixApi.fileManager.exists(path || '');
      if (!exists) return;

      const isDir = await remixApi.fileManager.isDirectory(path || '');
      
      if (isDir) {
        const files = await remixApi.fileManager.readdir(path || '');
        for (const file of files) {
          const fullPath = path ? `${path}/${file}` : file;
          if (!file.startsWith('.') && !file.includes('node_modules')) {
            await this.scanForImports(remixApi, fullPath, dependencies);
          }
        }
      } else if (path.endsWith('.sol')) {
        const content = await remixApi.fileManager.readFile(path);
        const imports = this.extractSolidityImports(content);
        dependencies.imports.push(...imports.map(imp => ({
          file: path,
          import: imp
        })));
      }
    } catch (error) {
      console.warn(`Failed to scan imports in ${path}:`, error);
    }
  }

  private extractSolidityImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ')) {
        imports.push(trimmed);
      }
    }
    
    return imports;
  }

  private parseConfig(filename: string, content: string): any {
    try {
      if (filename.endsWith('.json')) {
        return JSON.parse(content);
      } else if (filename.endsWith('.toml')) {
        // Basic TOML parsing for foundry.toml
        const lines = content.split('\n');
        const config: any = {};
        let currentSection = '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            currentSection = trimmed.slice(1, -1);
            config[currentSection] = {};
          } else if (trimmed.includes('=')) {
            const [key, value] = trimmed.split('=').map(s => s.trim());
            const section = currentSection || 'root';
            if (!config[section]) config[section] = {};
            config[section][key] = value.replace(/"/g, '');
          }
        }
        
        return config;
      } else {
        return { content, note: 'Raw content - parsing not implemented' };
      }
    } catch (error) {
      return { error: error.message, raw: content.slice(0, 500) };
    }
  }

  private async getWorkspacePath(remixApi: ICustomRemixApi): Promise<string> {
    // TODO: Get actual workspace path from Remix API
    return '';
  }

  private async getFileSize(remixApi: ICustomRemixApi, path: string): Promise<number> {
    try {
      const content = await remixApi.fileManager.readFile(path);
      return content.length;
    } catch {
      return 0;
    }
  }

  private shouldIncludeFile(path: string, extension: string): boolean {
    // Include source files and important project files
    const includedExtensions = ['sol', 'js', 'ts', 'json', 'md', 'txt', 'toml', 'yaml', 'yml'];
    const includedFiles = ['README', 'LICENSE', 'Dockerfile'];
    
    const filename = path.split('/').pop() || '';
    
    return includedExtensions.includes(extension) || 
           includedFiles.some(f => filename.toUpperCase().includes(f.toUpperCase()));
  }

  private getMimeTypeForFile(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'sol': 'text/x-solidity',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'json': 'application/json',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'toml': 'text/x-toml',
      'yaml': 'text/x-yaml',
      'yml': 'text/x-yaml'
    };
    
    return mimeTypes[extension] || 'text/plain';
  }

  private getCategoryForFile(extension: string): ResourceCategory {
    if (['sol'].includes(extension)) return ResourceCategory.CODE;
    if (['js', 'ts'].includes(extension)) return ResourceCategory.CODE;
    if (['json', 'toml', 'yaml', 'yml'].includes(extension)) return ResourceCategory.PROJECT;
    if (['md', 'txt'].includes(extension)) return ResourceCategory.DOCUMENTATION;
    return ResourceCategory.PROJECT;
  }

  private getTagsForFile(path: string, extension: string): string[] {
    const tags = [extension];
    
    if (path.includes('contract')) tags.push('contract');
    if (path.includes('test')) tags.push('test');
    if (path.includes('script')) tags.push('script');
    if (path.includes('migration')) tags.push('migration');
    if (path.includes('deploy')) tags.push('deployment');
    if (path.includes('config')) tags.push('config');
    if (path.includes('README')) tags.push('documentation', 'readme');
    
    return tags;
  }
}