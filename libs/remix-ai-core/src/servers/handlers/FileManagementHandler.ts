/**
 * File Management Tool Handlers for Remix MCP Server
 */

import { ICustomRemixApi } from '@remix-api';
import { MCPToolResult } from '../../types/mcp';
import { BaseToolHandler } from '../registry/RemixToolRegistry';
import { 
  ToolCategory, 
  RemixToolDefinition,
  FileReadArgs,
  FileWriteArgs,
  FileCreateArgs,
  FileDeleteArgs,
  FileMoveArgs,
  FileCopyArgs,
  DirectoryListArgs,
  FileOperationResult
} from '../types/mcpTools';

/**
 * File Read Tool Handler
 */
export class FileReadHandler extends BaseToolHandler {
  name = 'file_read';
  description = 'Read contents of a file';
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to read'
      }
    },
    required: ['path']
  };

  getPermissions(): string[] {
    return ['file:read'];
  }

  validate(args: FileReadArgs): boolean | string {
    const required = this.validateRequired(args, ['path']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { path: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: FileReadArgs, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      const exists = await remixApi.fileManager.methods.exists(args.path);
      if (!exists) {
        return this.createErrorResult(`File not found: ${args.path}`);
      }

      const content = await remixApi.fileManager.methods.readFile(args.path);
      
      const result: FileOperationResult = {
        success: true,
        path: args.path,
        content: content,
        size: content.length
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to read file: ${error.message}`);
    }
  }
}

/**
 * File Write Tool Handler
 */
export class FileWriteHandler extends BaseToolHandler {
  name = 'file_write';
  description = 'Write content to a file';
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to write'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        default: 'utf8'
      }
    },
    required: ['path', 'content']
  };

  getPermissions(): string[] {
    return ['file:write'];
  }

  validate(args: FileWriteArgs): boolean | string {
    const required = this.validateRequired(args, ['path', 'content']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { 
      path: 'string', 
      content: 'string',
      encoding: 'string'
    });
    if (types !== true) return types;

    return true;
  }

  async execute(args: FileWriteArgs, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      await remixApi.fileManager.methods.writeFile(args.path, args.content);
      
      const result: FileOperationResult = {
        success: true,
        path: args.path,
        message: 'File written successfully',
        size: args.content.length,
        lastModified: new Date().toISOString()
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to write file: ${error.message}`);
    }
  }
}

/**
 * File Create Tool Handler
 */
export class FileCreateHandler extends BaseToolHandler {
  name = 'file_create';
  description = 'Create a new file or directory';
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path for the new file or directory'
      },
      content: {
        type: 'string',
        description: 'Initial content for the file (optional)',
        default: ''
      },
      type: {
        type: 'string',
        enum: ['file', 'directory'],
        description: 'Type of item to create',
        default: 'file'
      }
    },
    required: ['path']
  };

  getPermissions(): string[] {
    return ['file:create'];
  }

  validate(args: FileCreateArgs): boolean | string {
    const required = this.validateRequired(args, ['path']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { 
      path: 'string',
      content: 'string',
      type: 'string'
    });
    if (types !== true) return types;

    if (args.type && !['file', 'directory'].includes(args.type)) {
      return 'Invalid type: must be "file" or "directory"';
    }

    return true;
  }

  async execute(args: FileCreateArgs, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      const exists = await remixApi.fileManager.methods.exists(args.path);
      if (exists) {
        return this.createErrorResult(`Path already exists: ${args.path}`);
      }

      if (args.type === 'directory') {
        await remixApi.fileManager.methods.mkdir(args.path);
      } else {
        await remixApi.fileManager.methods.writeFile(args.path, args.content || '');
      }
      
      const result: FileOperationResult = {
        success: true,
        path: args.path,
        message: `${args.type === 'directory' ? 'Directory' : 'File'} created successfully`,
        lastModified: new Date().toISOString()
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to create ${args.type || 'file'}: ${error.message}`);
    }
  }
}

/**
 * File Delete Tool Handler
 */
export class FileDeleteHandler extends BaseToolHandler {
  name = 'file_delete';
  description = 'Delete a file or directory';
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path of the file or directory to delete'
      }
    },
    required: ['path']
  };

  getPermissions(): string[] {
    return ['file:delete'];
  }

  validate(args: FileDeleteArgs): boolean | string {
    const required = this.validateRequired(args, ['path']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { path: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: FileDeleteArgs, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      const exists = await remixApi.fileManager.methods.exists(args.path);
      if (!exists) {
        return this.createErrorResult(`Path not found: ${args.path}`);
      }

      await remixApi.fileManager.methods.remove(args.path);
      
      const result: FileOperationResult = {
        success: true,
        path: args.path,
        message: 'Path deleted successfully'
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to delete: ${error.message}`);
    }
  }
}

/**
 * File Move Tool Handler
 */
export class FileMoveHandler extends BaseToolHandler {
  name = 'file_move';
  description = 'Move or rename a file or directory';
  inputSchema = {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        description: 'Source path'
      },
      to: {
        type: 'string',
        description: 'Destination path'
      }
    },
    required: ['from', 'to']
  };

  getPermissions(): string[] {
    return ['file:move'];
  }

  validate(args: FileMoveArgs): boolean | string {
    const required = this.validateRequired(args, ['from', 'to']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { from: 'string', to: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: FileMoveArgs, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      const exists = await remixApi.fileManager.methods.exists(args.from);
      if (!exists) {
        return this.createErrorResult(`Source path not found: ${args.from}`);
      }

      const destExists = await remixApi.fileManager.methods.exists(args.to);
      if (destExists) {
        return this.createErrorResult(`Destination path already exists: ${args.to}`);
      }

      await remixApi.fileManager.methods.rename(args.from, args.to);
      
      const result: FileOperationResult = {
        success: true,
        path: args.to,
        message: `Moved from ${args.from} to ${args.to}`,
        lastModified: new Date().toISOString()
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to move: ${error.message}`);
    }
  }
}

/**
 * File Copy Tool Handler
 */
export class FileCopyHandler extends BaseToolHandler {
  name = 'file_copy';
  description = 'Copy a file or directory';
  inputSchema = {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        description: 'Source path'
      },
      to: {
        type: 'string',
        description: 'Destination path'
      }
    },
    required: ['from', 'to']
  };

  getPermissions(): string[] {
    return ['file:copy'];
  }

  validate(args: FileCopyArgs): boolean | string {
    const required = this.validateRequired(args, ['from', 'to']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { from: 'string', to: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: FileCopyArgs, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      const exists = await remixApi.fileManager.methods.exists(args.from);
      if (!exists) {
        return this.createErrorResult(`Source path not found: ${args.from}`);
      }

      const content = await remixApi.fileManager.methods.readFile(args.from);
      await remixApi.fileManager.methods.writeFile(args.to, content);
      
      const result: FileOperationResult = {
        success: true,
        path: args.to,
        message: `Copied from ${args.from} to ${args.to}`,
        size: content.length,
        lastModified: new Date().toISOString()
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to copy: ${error.message}`);
    }
  }
}

/**
 * Directory List Tool Handler
 */
export class DirectoryListHandler extends BaseToolHandler {
  name = 'directory_list';
  description = 'List contents of a directory';
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list'
      },
      recursive: {
        type: 'boolean',
        description: 'List recursively',
        default: false
      }
    },
    required: ['path']
  };

  getPermissions(): string[] {
    return ['file:read'];
  }

  validate(args: DirectoryListArgs): boolean | string {
    const required = this.validateRequired(args, ['path']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { path: 'string', recursive: 'boolean' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: DirectoryListArgs, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      const exists = await remixApi.fileManager.methods.exists(args.path);
      if (!exists) {
        return this.createErrorResult(`Directory not found: ${args.path}`);
      }

      const files = await remixApi.fileManager.methods.readdir(args.path);
      const fileList = [];

      for (const file of files) {
        const fullPath = `${args.path}/${file}`;
        try {
          const isDir = await remixApi.fileManager.methods.isDirectory(fullPath);
          let size = 0;
          
          if (!isDir) {
            const content = await remixApi.fileManager.methods.readFile(fullPath);
            size = content.length;
          }

          fileList.push({
            name: file,
            path: fullPath,
            isDirectory: isDir,
            size: size
          });

          // Recursive listing
          if (args.recursive && isDir) {
            const subFiles = await this.execute({ path: fullPath, recursive: true }, remixApi);
            if (!subFiles.isError && subFiles.content[0]?.text) {
              const subResult = JSON.parse(subFiles.content[0].text);
              if (subResult.files) {
                fileList.push(...subResult.files);
              }
            }
          }
        } catch (error) {
          // Skip files that can't be accessed
          console.warn(`Couldn't access ${fullPath}:`, error.message);
        }
      }
      
      const result = {
        success: true,
        path: args.path,
        files: fileList,
        count: fileList.length
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to list directory: ${error.message}`);
    }
  }
}

/**
 * File Exists Tool Handler
 */
export class FileExistsHandler extends BaseToolHandler {
  name = 'file_exists';
  description = 'Check if a file or directory exists';
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to check'
      }
    },
    required: ['path']
  };

  getPermissions(): string[] {
    return ['file:read'];
  }

  validate(args: { path: string }): boolean | string {
    const required = this.validateRequired(args, ['path']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { path: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: { path: string }, remixApi: ICustomRemixApi): Promise<MCPToolResult> {
    try {
      const exists = await remixApi.fileManager.methods.exists(args.path);
      
      const result = {
        success: true,
        path: args.path,
        exists: exists
      };

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Failed to check file existence: ${error.message}`);
    }
  }
}

/**
 * Create file management tool definitions
 */
export function createFileManagementTools(): RemixToolDefinition[] {
  return [
    {
      name: 'file_read',
      description: 'Read contents of a file',
      inputSchema: new FileReadHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:read'],
      handler: new FileReadHandler()
    },
    {
      name: 'file_write',
      description: 'Write content to a file',
      inputSchema: new FileWriteHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:write'],
      handler: new FileWriteHandler()
    },
    {
      name: 'file_create',
      description: 'Create a new file or directory',
      inputSchema: new FileCreateHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:create'],
      handler: new FileCreateHandler()
    },
    {
      name: 'file_delete',
      description: 'Delete a file or directory',
      inputSchema: new FileDeleteHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:delete'],
      handler: new FileDeleteHandler()
    },
    {
      name: 'file_move',
      description: 'Move or rename a file or directory',
      inputSchema: new FileMoveHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:move'],
      handler: new FileMoveHandler()
    },
    {
      name: 'file_copy',
      description: 'Copy a file or directory',
      inputSchema: new FileCopyHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:copy'],
      handler: new FileCopyHandler()
    },
    {
      name: 'directory_list',
      description: 'List contents of a directory',
      inputSchema: new DirectoryListHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:read'],
      handler: new DirectoryListHandler()
    },
    {
      name: 'file_exists',
      description: 'Check if a file or directory exists',
      inputSchema: new FileExistsHandler().inputSchema,
      category: ToolCategory.FILE_MANAGEMENT,
      permissions: ['file:read'],
      handler: new FileExistsHandler()
    }
  ];
}