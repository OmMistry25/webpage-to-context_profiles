import axios, { AxiosInstance, AxiosResponse } from 'axios'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'

export interface CLIConfig {
  apiUrl: string
  clientId?: string
  clientSecret?: string
  accessToken?: string
  userId?: string
}

export interface SearchRequest {
  query: string
  userId: string
  scope: 'projects' | 'crawls' | 'chunks' | 'all'
  filters?: {
    projectIds?: string[]
    dateRange?: { start: string; end: string }
    dataTypes?: string[]
  }
  limit?: number
  offset?: number
}

export interface SearchResult {
  type: 'project' | 'crawl' | 'chunk'
  id: string
  [key: string]: any
}

export interface ExportRequest {
  resourceType: 'project' | 'crawl' | 'user-data'
  resourceId: string
  userId: string
  format: 'zip' | 'json' | 'csv'
  includeEmbeddings?: boolean
  includeMetadata?: boolean
}

export class WebToContextAPI {
  private client: AxiosInstance
  private config: CLIConfig

  constructor(config: CLIConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'web-to-context-cli/0.1.0'
      }
    })

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      if (this.config.accessToken) {
        config.headers.Authorization = `Bearer ${this.config.accessToken}`
      }
      return config
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.error(chalk.red('Authentication failed. Please run: web-to-context auth login'))
        } else if (error.response?.status === 403) {
          console.error(chalk.red('Insufficient permissions. Please check your access rights.'))
        } else if (error.response?.status === 429) {
          console.error(chalk.red('Rate limit exceeded. Please try again later.'))
        } else if (error.response?.data?.error) {
          console.error(chalk.red('API Error:'), error.response.data.error)
        } else {
          console.error(chalk.red('Request failed:'), error.message)
        }
        throw error
      }
    )
  }

  // Authentication methods
  async registerClient(name: string, description: string, redirectUri: string, scopes: string[]): Promise<any> {
    const response = await this.client.post('/api/cli/auth/register', {
      name,
      description,
      redirectUri,
      scopes
    })
    return response.data
  }

  async requestToken(clientId: string, clientSecret: string, code: string): Promise<any> {
    const response = await this.client.post('/api/cli/auth/token', {
      clientId,
      clientSecret,
      code,
      grantType: 'authorization_code'
    })
    return response.data
  }

  async grantPermission(userId: string, clientId: string, scopes: string[], filters?: any, expiresIn?: number): Promise<any> {
    const response = await this.client.post('/api/cli/auth/permissions', {
      userId,
      clientId,
      scopes,
      filters,
      expiresIn
    })
    return response.data
  }

  async getPermissions(userId?: string, clientId?: string): Promise<any> {
    const params = new URLSearchParams()
    if (userId) params.append('userId', userId)
    if (clientId) params.append('clientId', clientId)
    
    const response = await this.client.get(`/api/cli/auth/permissions?${params.toString()}`)
    return response.data
  }

  async revokePermission(permissionId?: string, clientId?: string): Promise<any> {
    const params = new URLSearchParams()
    if (permissionId) params.append('permissionId', permissionId)
    if (clientId) params.append('clientId', clientId)
    
    const response = await this.client.delete(`/api/cli/auth/permissions?${params.toString()}`)
    return response.data
  }

  // Data access methods
  async search(request: SearchRequest): Promise<{ results: SearchResult[]; totalResults: number }> {
    const response = await this.client.post('/api/cli/search', request)
    return response.data
  }

  async export(request: ExportRequest): Promise<{ downloadUrl: string }> {
    const response = await this.client.post('/api/cli/export', request)
    return response.data
  }

  async listProjects(userId: string): Promise<any> {
    const response = await this.client.get(`/api/cli/projects?userId=${userId}`)
    return response.data
  }

  async listCrawls(userId: string, projectId?: string): Promise<any> {
    const params = new URLSearchParams({ userId })
    if (projectId) params.append('projectId', projectId)
    
    const response = await this.client.get(`/api/cli/crawls?${params.toString()}`)
    return response.data
  }

  // Configuration methods
  async saveConfig(): Promise<void> {
    const configPath = path.join(os.homedir(), '.web-to-context', 'config.json')
    await fs.ensureDir(path.dirname(configPath))
    await fs.writeJson(configPath, this.config, { spaces: 2 })
  }

  async loadConfig(): Promise<CLIConfig> {
    const configPath = path.join(os.homedir(), '.web-to-context', 'config.json')
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath)
      this.config = { ...this.config, ...config }
      return this.config
    }
    
    return this.config
  }

  async clearConfig(): Promise<void> {
    const configPath = path.join(os.homedir(), '.web-to-context', 'config.json')
    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath)
    }
    this.config = {
      apiUrl: this.config.apiUrl,
      clientId: undefined,
      clientSecret: undefined,
      accessToken: undefined,
      userId: undefined
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!(this.config.accessToken && this.config.userId)
  }

  getConfig(): CLIConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<CLIConfig>): void {
    this.config = { ...this.config, ...updates }
  }
}
