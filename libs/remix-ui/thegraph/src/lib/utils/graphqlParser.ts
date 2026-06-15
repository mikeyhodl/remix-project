// Utility for parsing and handling GraphQL files with metadata

import { SupportedNetwork } from '../types'

/**
 * Metadata extracted from .graphql file comments
 */
export interface GraphQLFileMetadata {
  endpoint?: string
  network?: SupportedNetwork
  description?: string
  variables?: Record<string, any>
}

/**
 * Parsed GraphQL file structure
 */
export interface ParsedGraphQLFile {
  query: string
  metadata: GraphQLFileMetadata
  operationName?: string
  operationType?: 'query' | 'mutation' | 'subscription'
}

/**
 * Regular expressions for parsing metadata comments
 */
const METADATA_PATTERNS = {
  endpoint: /^#\s*@endpoint:\s*(.+)$/m,
  network: /^#\s*@network:\s*(.+)$/m,
  description: /^#\s*@description:\s*(.+)$/m,
  variables: /^#\s*@variables:\s*(.+)$/m
}

/**
 * Regular expression for operation name extraction
 */
const OPERATION_REGEX = /^\s*(query|mutation|subscription)\s+(\w+)?/m

/**
 * Parse a .graphql file content and extract metadata
 */
export const parseGraphQLFile = (content: string): ParsedGraphQLFile => {
  const metadata: GraphQLFileMetadata = {}

  // Extract metadata from comments
  const endpointMatch = content.match(METADATA_PATTERNS.endpoint)
  if (endpointMatch) {
    metadata.endpoint = endpointMatch[1].trim()
  }

  const networkMatch = content.match(METADATA_PATTERNS.network)
  if (networkMatch) {
    metadata.network = networkMatch[1].trim() as SupportedNetwork
  }

  const descriptionMatch = content.match(METADATA_PATTERNS.description)
  if (descriptionMatch) {
    metadata.description = descriptionMatch[1].trim()
  }

  const variablesMatch = content.match(METADATA_PATTERNS.variables)
  if (variablesMatch) {
    try {
      metadata.variables = JSON.parse(variablesMatch[1].trim())
    } catch (e) {
      console.warn('Failed to parse variables metadata:', e)
    }
  }

  // Remove metadata comments from query
  let query = content
  Object.values(METADATA_PATTERNS).forEach(pattern => {
    query = query.replace(pattern, '')
  })

  // Clean up leading/trailing whitespace and extra newlines
  query = query.trim()

  // Extract operation name and type
  const operationMatch = query.match(OPERATION_REGEX)
  let operationName: string | undefined
  let operationType: 'query' | 'mutation' | 'subscription' | undefined

  if (operationMatch) {
    operationType = operationMatch[1] as 'query' | 'mutation' | 'subscription'
    operationName = operationMatch[2]
  }

  return {
    query,
    metadata,
    operationName,
    operationType
  }
}

/**
 * Generate .graphql file content with metadata
 */
export const generateGraphQLFileContent = (
  query: string,
  metadata: GraphQLFileMetadata
): string => {
  const lines: string[] = []

  // Add metadata comments
  if (metadata.endpoint) {
    lines.push(`# @endpoint: ${metadata.endpoint}`)
  }
  if (metadata.network) {
    lines.push(`# @network: ${metadata.network}`)
  }
  if (metadata.description) {
    lines.push(`# @description: ${metadata.description}`)
  }

  // Add empty line after metadata
  if (lines.length > 0) {
    lines.push('')
  }

  // Add query
  lines.push(query)

  // Add variables at the end
  if (metadata.variables && Object.keys(metadata.variables).length > 0) {
    lines.push('')
    lines.push(`# @variables: ${JSON.stringify(metadata.variables)}`)
  }

  return lines.join('\n')
}

/**
 * Validate GraphQL query syntax (basic validation)
 */
export const validateGraphQLSyntax = (query: string): { valid: boolean; error?: string } => {
  // Basic validation - check for balanced braces
  let braceCount = 0
  let parenCount = 0

  for (const char of query) {
    if (char === '{') braceCount++
    if (char === '}') braceCount--
    if (char === '(') parenCount++
    if (char === ')') parenCount--

    if (braceCount < 0) {
      return { valid: false, error: 'Unmatched closing brace }' }
    }
    if (parenCount < 0) {
      return { valid: false, error: 'Unmatched closing parenthesis )' }
    }
  }

  if (braceCount !== 0) {
    return { valid: false, error: 'Unmatched braces' }
  }
  if (parenCount !== 0) {
    return { valid: false, error: 'Unmatched parentheses' }
  }

  // Check for query/mutation/subscription keyword or shorthand query
  const trimmed = query.trim()
  if (!trimmed.startsWith('{') &&
      !trimmed.startsWith('query') &&
      !trimmed.startsWith('mutation') &&
      !trimmed.startsWith('subscription') &&
      !trimmed.startsWith('fragment')) {
    return { valid: false, error: 'Query must start with query, mutation, subscription, fragment, or {' }
  }

  return { valid: true }
}

/**
 * Extract variables from a GraphQL query
 */
export const extractQueryVariables = (query: string): string[] => {
  const variableRegex = /\$(\w+)\s*:/g
  const variables: string[] = []
  let match

  while ((match = variableRegex.exec(query)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }

  return variables
}

/**
 * Format GraphQL query with proper indentation
 */
export const formatGraphQLQuery = (query: string): string => {
  const lines = query.split('\n')
  let indentLevel = 0
  const formattedLines: string[] = []

  for (let line of lines) {
    line = line.trim()
    if (!line) continue

    // Decrease indent for closing braces
    if (line.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1)
    }

    // Add indentation
    formattedLines.push('  '.repeat(indentLevel) + line)

    // Increase indent for opening braces
    if (line.endsWith('{')) {
      indentLevel++
    }
  }

  return formattedLines.join('\n')
}

/**
 * Generate a default file name from query operation
 */
export const generateQueryFileName = (query: string): string => {
  const parsed = parseGraphQLFile(query)

  if (parsed.operationName) {
    // Convert camelCase/PascalCase to kebab-case
    const kebabName = parsed.operationName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
    return `${kebabName}.graphql`
  }

  // Default name with timestamp
  const timestamp = Date.now().toString(36)
  return `query-${timestamp}.graphql`
}

/**
 * Check if content is a valid GraphQL file
 */
export const isGraphQLFile = (fileName: string): boolean => {
  return fileName.endsWith('.graphql') || fileName.endsWith('.gql')
}

/**
 * Schema introspection query
 */
export const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        name
        kind
        description
        fields(includeDeprecated: true) {
          name
          description
          args {
            name
            description
            type {
              ...TypeRef
            }
            defaultValue
          }
          type {
            ...TypeRef
          }
          isDeprecated
          deprecationReason
        }
        inputFields {
          name
          description
          type {
            ...TypeRef
          }
          defaultValue
        }
        interfaces {
          ...TypeRef
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
        possibleTypes {
          ...TypeRef
        }
      }
    }
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`
