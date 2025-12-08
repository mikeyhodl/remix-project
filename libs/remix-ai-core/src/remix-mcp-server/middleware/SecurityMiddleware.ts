/**
 * Security Middleware for Remix MCP Server
 */

import { Plugin } from '@remixproject/engine';
import { IMCPToolCall } from '../../types/mcp';
import { ToolExecutionContext } from '../types/mcpTools';
import { RemixToolRegistry } from '../registry/RemixToolRegistry';
import { MCPSecurityConfig } from '../types/mcpConfig';
import { MCPConfigManager } from '../config/MCPConfigManager';
import { BaseMiddleware } from './BaseMiddleware';

export interface SecurityValidationResult {
  allowed: boolean;
  reason?: string;
  risk?: 'low' | 'medium' | 'high';
}

export interface AuditLogEntry {
  timestamp: Date;
  toolName: string;
  userId?: string;
  arguments: any;
  result: 'success' | 'error' | 'blocked';
  reason?: string;
  executionTime: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Security middleware for validating and securing MCP tool calls
 */
export class SecurityMiddleware extends BaseMiddleware {
  private rateLimitTracker = new Map<string, { count: number; resetTime: number }>();
  private auditLog: AuditLogEntry[] = [];
  private toolRegistry?: RemixToolRegistry;
  private config: MCPSecurityConfig;
  private rateLimitCleanupInterval?: NodeJS.Timeout;

  constructor(toolRegistry?: RemixToolRegistry, configManager?: MCPConfigManager) {
    super(configManager);
    this.toolRegistry = toolRegistry;

    this.config = configManager.getSecurityConfig() as MCPSecurityConfig;

    // Setup periodic cleanup of rate limit tracker (every 5 minutes)
    this.rateLimitCleanupInterval = setInterval(() => {
      this.cleanupRateLimitTracker();
    }, 300000);
  }

  private getConfig(): MCPSecurityConfig {
    if (this.configManager) {
      return this.configManager.getSecurityConfig();
    }
    return this.config;
  }

  async validateToolCall(
    call: IMCPToolCall,
    context: ToolExecutionContext,
    plugin: Plugin
  ): Promise<SecurityValidationResult> {
    const startTime = Date.now();
    const config = this.getConfig();

    try {
      // Check if tool is allowed (exclude/allow lists)
      const toolAllowedResult = this.checkToolAllowed(call.name);
      if (!toolAllowedResult.allowed) {
        this.logAudit(call, context, 'blocked', toolAllowedResult.reason, startTime, 'high');
        return toolAllowedResult;
      }

      // Rate limiting check
      const rateLimitResult = this.checkRateLimit(context);
      if (!rateLimitResult.allowed) {
        this.logAudit(call, context, 'blocked', rateLimitResult.reason, startTime, 'medium');
        return rateLimitResult;
      }

      // Permission validation
      const permissionResult = this.validatePermissions(call, context);
      if (!permissionResult.allowed) {
        this.logAudit(call, context, 'blocked', permissionResult.reason, startTime, 'high');
        return permissionResult;
      }

      // Argument validation
      const argumentResult = await this.validateArguments(call, plugin);
      if (!argumentResult.allowed) {
        this.logAudit(call, context, 'blocked', argumentResult.reason, startTime, argumentResult.risk || 'medium');
        return argumentResult;
      }

      // File operation security checks
      const fileResult = await this.validateFileOperations(call, plugin);
      if (!fileResult.allowed) {
        this.logAudit(call, context, 'blocked', fileResult.reason, startTime, fileResult.risk || 'high');
        return fileResult;
      }

      // Input sanitization
      const sanitizationResult = this.validateInputSanitization(call);
      if (!sanitizationResult.allowed) {
        this.logAudit(call, context, 'blocked', sanitizationResult.reason, startTime, 'high');
        return sanitizationResult;
      }

      this.logAudit(call, context, 'success', 'Validation passed', startTime, 'low');
      return { allowed: true, risk: 'low' };

    } catch (error) {
      this.logAudit(call, context, 'error', `Validation error: ${error.message}`, startTime, 'high');
      return {
        allowed: false,
        reason: `Security validation failed: ${error.message}`,
        risk: 'high'
      };
    }
  }

  private checkToolAllowed(toolName: string): SecurityValidationResult {
    const config = this.getConfig();

    // Use ConfigManager if available
    if (this.configManager) {
      const allowed = this.configManager.isToolAllowed(toolName);
      if (!allowed) {
        return {
          allowed: false,
          reason: `Tool '${toolName}' is not allowed by configuration`,
          risk: 'high'
        };
      }
      return { allowed: true, risk: 'low' };
    }

    if (config.excludeTools && config.excludeTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' is excluded by security configuration`,
        risk: 'high'
      };
    }

    return { allowed: true, risk: 'low' };
  }

  private checkRateLimit(context: ToolExecutionContext): SecurityValidationResult {
    const config = this.getConfig();
    const identifier = context.userId || context.sessionId || 'anonymous';
    const now = Date.now();
    const resetTime = Math.floor(now / 60000) * 60000 + 60000; // Next minute

    // Check if rate limiting is disabled
    if (config.rateLimit && !config.rateLimit.enabled) {
      return { allowed: true, risk: 'low' };
    }

    const maxRequests = config.rateLimit?.requestsPerMinute || config.maxRequestsPerMinute;

    const userLimit = this.rateLimitTracker.get(identifier);
    if (!userLimit || userLimit.resetTime <= now) {
      this.rateLimitTracker.set(identifier, { count: 1, resetTime });
      return { allowed: true, risk: 'low' };
    }

    if (userLimit.count >= maxRequests) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${userLimit.count}/${maxRequests} requests per minute`,
        risk: 'medium'
      };
    }

    userLimit.count++;
    return { allowed: true, risk: 'low' };
  }

  /**
   * Validate user permissions for tool execution
   */
  private validatePermissions(call: IMCPToolCall, context: ToolExecutionContext): SecurityValidationResult {
    if (!this.config.requirePermissions) {
      return { allowed: true, risk: 'low' };
    }

    // Check if user has wildcard permission
    if (context.permissions.includes('*')) {
      return { allowed: true, risk: 'low' };
    }

    // Get required permissions for this tool (would need to be passed from tool definition)
    const requiredPermissions = this.getRequiredPermissions(call.name);

    for (const permission of requiredPermissions) {
      if (!context.permissions.includes(permission)) {
        return {
          allowed: false,
          reason: `Missing required permission: ${permission}`,
          risk: 'high'
        };
      }
    }

    return { allowed: true, risk: 'low' };
  }

  /**
   * Validate tool arguments for security issues
   *
   * IMPORTANT: For file operations (file_write, file_create), we treat 'content'
   * arguments as code, not user input, to avoid false positives for legitimate
   * code patterns like require(), eval(), etc.
   */
  private async validateArguments(call: IMCPToolCall, plugin: Plugin): Promise<SecurityValidationResult> {
    const args = call.arguments || {};
    console.log('validateArguments', args)

    // File operation tools where 'content' is expected to be code
    const fileOperationTools = ['file_write', 'file_create', 'file_update'];
    const isFileOperation = fileOperationTools.includes(call.name);

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        const context = (isFileOperation && key === 'content') ? 'code' : 'input';

        const dangerousPattern = this.findDangerousPattern(value, context);
        if (dangerousPattern) {
          return {
            allowed: false,
            reason: `Potentially dangerous content detected in argument ${key}: ${dangerousPattern}`,
            risk: 'high'
          };
        }

        // Check for extremely long strings that might cause DoS
        if (value.length > 100000) {
          return {
            allowed: false,
            reason: `Argument ${key} exceeds maximum length (100KB)`,
            risk: 'medium'
          };
        }
      }
    }

    return { allowed: true, risk: 'low' };
  }

  private async validateFileOperations(call: IMCPToolCall, plugin: Plugin): Promise<SecurityValidationResult> {
    const args = call.arguments || {};
    const fileOps = ['file_read', 'file_write', 'file_create', 'file_delete', 'file_move', 'file_copy'];

    if (!fileOps.includes(call.name)) {
      return { allowed: true, risk: 'low' };
    }

    const pathArgs = ['path', 'from', 'to', 'sourceFile'];
    for (const pathArg of pathArgs) {
      if (args[pathArg]) {
        const pathResult = this.validateFilePath(args[pathArg]);
        if (!pathResult.allowed) {
          return pathResult;
        }
      }
    }

    // Check file content size
    if (args.content && typeof args.content === 'string') {
      if (args.content.length > this.config.maxFileSize) {
        return {
          allowed: false,
          reason: `File content exceeds maximum size (${this.config.maxFileSize} bytes)`,
          risk: 'medium'
        };
      }
    }

    // Check file type restrictions
    if (args.path && this.config.allowedFileTypes.length > 0) {
      const extension = args.path.split('.').pop()?.toLowerCase();
      if (extension && !this.config.allowedFileTypes.includes(extension)) {
        return {
          allowed: false,
          reason: `File type .${extension} is not allowed`,
          risk: 'medium'
        };
      }
    }

    return { allowed: true, risk: 'low' };
  }

  /**
   * Validate file path for security issues
   */
  private validateFilePath(path: string): SecurityValidationResult {
    const config = this.getConfig();

    // Check for path traversal attacks
    if (path.includes('..') || path.includes('~')) {
      return {
        allowed: false,
        reason: 'Path traversal detected',
        risk: 'high'
      };
    }

    // Check for absolute paths outside workspace
    if (path.startsWith('/') && !path.startsWith('/workspace')) {
      return {
        allowed: false,
        reason: 'Absolute path outside workspace',
        risk: 'high'
      };
    }

    // Use ConfigManager if available
    if (this.configManager) {
      const allowed = this.configManager.isPathAllowed(path);
      if (!allowed) {
        return {
          allowed: false,
          reason: 'Path not allowed by configuration',
          risk: 'high'
        };
      }
      return { allowed: true, risk: 'low' };
    }

    // Check blocked paths
    for (const blockedPath of config.blockedPaths) {
      if (path.includes(blockedPath)) {
        return {
          allowed: false,
          reason: `Path contains blocked segment: ${blockedPath}`,
          risk: 'high'
        };
      }
    }

    // Check allowed paths (if set, only allow paths matching patterns)
    if (config.allowedPaths && config.allowedPaths.length > 0) {
      let pathAllowed = false;
      for (const allowedPattern of config.allowedPaths) {
        if (path.includes(allowedPattern) || this.matchPattern(path, allowedPattern)) {
          pathAllowed = true;
          break;
        }
      }
      if (!pathAllowed) {
        return {
          allowed: false,
          reason: 'Path not in allowed paths list',
          risk: 'high'
        };
      }
    }

    // Check for system files
    const systemFiles = ['.env', '.git', 'node_modules', '.ssh', 'id_rsa'];
    for (const systemFile of systemFiles) {
      if (path.includes(systemFile)) {
        return {
          allowed: false,
          reason: `Access to system file/directory not allowed: ${systemFile}`,
          risk: 'high'
        };
      }
    }

    return { allowed: true, risk: 'low' };
  }

  /**
   * Validate input sanitization (check for injection patterns)
   *
   * IMPORTANT: This is more lenient for file content in file operations
   */
  private validateInputSanitization(call: IMCPToolCall): SecurityValidationResult {
    const args = call.arguments || {};

    // File operation tools where 'content' is expected to be code
    const fileOperationTools = ['file_write', 'file_create', 'file_update'];
    const isFileOperation = fileOperationTools.includes(call.name);

    const cmdPatterns = [
      /;\s*rm\s+-rf\s+\//i, // Severe: rm -rf /
      /&&\s*rm\s+-rf\s+\//i, // Severe: chained rm -rf /
      /\|\s*rm\s+-rf\s+\//i, // Severe: piped rm -rf /
      />\s*\/dev\//i, // Redirect to devices
      /curl\s.*\|\s*sh/i, // Piped curl to shell
      /wget\s.*\|\s*sh/i, // Piped wget to shell
    ];

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        if (isFileOperation && key === 'content' && this.isLikelyCodeContent(value)) {
          continue;
        }

        for (const pattern of cmdPatterns) {
          if (pattern.test(value)) {
            return {
              allowed: false,
              reason: `Potentially malicious content detected in ${key}: ${pattern}`,
              risk: 'high'
            };
          }
        }
      }
    }

    return { allowed: true, risk: 'low' };
  }

  private getRequiredPermissions(toolName: string): string[] {
    if (this.toolRegistry) {
      const toolDefinition = this.toolRegistry.get(toolName);
      if (toolDefinition && toolDefinition.permissions && toolDefinition.permissions.length > 0) {
        console.log(`[SecurityMiddleware] Tool '${toolName}' requires permissions:`, toolDefinition.permissions);
        return toolDefinition.permissions;
      }
    }

    console.log(`[SecurityMiddleware] Tool '${toolName}' has no specific permissions defined, granting all permissions (*)`);
    return ['*'];
  }

  private logAudit(
    call: IMCPToolCall,
    context: ToolExecutionContext,
    result: 'success' | 'error' | 'blocked',
    reason: string,
    startTime: number,
    riskLevel: 'low' | 'medium' | 'high'
  ): void {
    if (!this.config.enableAuditLog) return;

    const entry: AuditLogEntry = {
      timestamp: new Date(),
      toolName: call.name,
      userId: context.userId,
      arguments: call.arguments || {},
      result,
      reason,
      executionTime: Date.now() - startTime,
      riskLevel
    };

    this.auditLog.push(entry);

    if (this.auditLog.length > 1000) {
      this.auditLog.splice(0, this.auditLog.length - 1000);
    }

    if (riskLevel === 'high') {
      console.warn('High-risk security event:', entry);
    }
  }

  getAuditLog(limit = 100): AuditLogEntry[] {
    return this.auditLog.slice(-limit);
  }

  private cleanupRateLimitTracker(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [identifier, limit] of this.rateLimitTracker.entries()) {
      if (limit.resetTime <= now) {
        entriesToDelete.push(identifier);
      }
    }

    for (const identifier of entriesToDelete) {
      this.rateLimitTracker.delete(identifier);
    }

    if (entriesToDelete.length > 0) {
      console.log(`[SecurityMiddleware] Cleaned up ${entriesToDelete.length} expired rate limit entries`);
    }
  }

  destroy(): void {
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = undefined;
    }
    this.rateLimitTracker.clear();
    this.auditLog = [];
  }
}