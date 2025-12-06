/**
 * Generic API client for making authenticated requests to Remix backend services
 * All requests automatically include Bearer token authentication
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
  credentials?: RequestCredentials
}

export interface ApiResponse<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

export interface IApiClient {
  /**
   * Make an authenticated HTTP request
   * @param endpoint - API endpoint path (relative to base URL)
   * @param options - Request options
   * @returns Typed response
   */
  request<TResponse>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<TResponse>>
  
  /**
   * GET request helper
   */
  get<TResponse>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<TResponse>>
  
  /**
   * POST request helper
   */
  post<TResponse>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<TResponse>>
  
  /**
   * PUT request helper
   */
  put<TResponse>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<TResponse>>
  
  /**
   * DELETE request helper
   */
  delete<TResponse>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<TResponse>>
  
  /**
   * Set the authentication token
   */
  setToken(token: string | null): void
  
  /**
   * Get current token
   */
  getToken(): string | null
}

/**
 * Base API client implementation
 */
export class ApiClient implements IApiClient {
  private token: string | null = null
  
  constructor(private baseUrl: string) {}
  
  setToken(token: string | null): void {
    this.token = token
  }
  
  getToken(): string | null {
    return this.token
  }
  
  async request<TResponse>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<TResponse>> {
    const {
      method = 'GET',
      body,
      headers = {},
      credentials = 'include'
    } = options
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    }
    
    // Add Bearer token if available
    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`
    }
    
    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        credentials,
        ...(body && { body: JSON.stringify(body) })
      })
      
      let data: TResponse | undefined
      const contentType = response.headers.get('content-type')
      
      // Parse JSON response if available
      if (contentType?.includes('application/json')) {
        try {
          data = await response.json()
        } catch (e) {
          // Response might be empty or invalid JSON
        }
      }
      
      if (!response.ok) {
        const errorData = data as any
        return {
          ok: false,
          status: response.status,
          error: errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`
        }
      }
      
      return {
        ok: true,
        status: response.status,
        data
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Network error'
      }
    }
  }
  
  async get<TResponse>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>(endpoint, { ...options, method: 'GET' })
  }
  
  async post<TResponse>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>(endpoint, { ...options, method: 'POST', body })
  }
  
  async put<TResponse>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>(endpoint, { ...options, method: 'PUT', body })
  }
  
  async delete<TResponse>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>(endpoint, { ...options, method: 'DELETE' })
  }
}
