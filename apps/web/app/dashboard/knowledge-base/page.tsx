'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import Link from 'next/link'
import TreeMap from './components/TreeMap'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface Crawl {
  id: string
  project_id: string
  root_url: string
  scope: string
  max_depth: number
  max_pages: number
  status: string
  created_at: string
  pages_count?: number
  chunks_count?: number
}

interface SearchResult {
  id: string
  page_id: string
  content: string
  token_count: number
  chunk_index: number
  similarity_score: number
  keyword_score: number
  combined_score: number
  page_title?: string
  page_url?: string
  crawl_id?: string
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
  searchOptions: {
    limit: number
    semanticWeight: number
    keywordWeight: number
    projectId?: string
  }
}

interface TreeMapData {
  name: string
  value: number
  children?: TreeMapData[]
  url?: string
  type?: 'project' | 'crawl' | 'page'
}

export default function KnowledgeBasePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [crawls, setCrawls] = useState<Crawl[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'browse'>('overview')
  const [searchOptions, setSearchOptions] = useState({
    limit: 10,
    semanticWeight: 0.7,
    keywordWeight: 0.3
  })

  const supabase = createClient()

  useEffect(() => {
    fetchProjects()
    fetchCrawls()
  }, [])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
    }
  }

  const fetchCrawls = async () => {
    try {
      const { data, error } = await supabase
        .from('crawls')
        .select(`
          *,
          pages(count),
          chunks(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const crawlsWithCounts = (data || []).map((crawl: any) => ({
        ...crawl,
        pages_count: crawl.pages?.[0]?.count || 0,
        chunks_count: crawl.chunks?.[0]?.count || 0
      }))
      
      setCrawls(crawlsWithCounts)
    } catch (err) {
      console.error('Error fetching crawls:', err)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          ...searchOptions,
          projectId: selectedProject || undefined
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data: SearchResponse = await response.json()
      setSearchResults(data.results)
      setActiveTab('search')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'domain': return '🌐'
      case 'subdomain': return '🏢'
      case 'path': return '📁'
      default: return '🔗'
    }
  }

  const generateTreeMapData = (): TreeMapData[] => {
    return projects.map(project => {
      const projectCrawls = crawls.filter(crawl => crawl.project_id === project.id)
      const totalPages = projectCrawls.reduce((sum, crawl) => sum + (crawl.pages_count || 0), 0)
      const totalChunks = projectCrawls.reduce((sum, crawl) => sum + (crawl.chunks_count || 0), 0)

      return {
        name: project.name,
        value: totalChunks || 1, // Use chunks as the main value
        type: 'project',
        children: projectCrawls.map(crawl => ({
          name: new URL(crawl.root_url).hostname,
          value: crawl.chunks_count || 1,
          type: 'crawl' as const,
          url: crawl.root_url
        }))
      }
    })
  }

  const handleTreeMapNodeClick = (node: TreeMapData) => {
    if (node.type === 'project') {
      const project = projects.find(p => p.name === node.name)
      if (project) {
        setSelectedProject(project.id)
        setActiveTab('browse')
      }
    } else if (node.type === 'crawl' && node.url) {
      const crawl = crawls.find(c => c.root_url === node.url)
      if (crawl) {
        window.open(`/dashboard/crawls/${crawl.id}`, '_blank')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
              <p className="text-gray-600">Explore and search your crawled content</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/dashboard/chat"
                className="bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                AI Chat
              </Link>
              <Link
                href="/dashboard"
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/search"
                className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Advanced Search
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Search Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your knowledge base..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="w-48">
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Projects</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'overview'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📊 Overview
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'search'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🔍 Search Results
                </button>
                <button
                  onClick={() => setActiveTab('browse')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'browse'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🌳 Browse Content
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-blue-50 rounded-lg p-6">
                      <div className="flex items-center">
                        <div className="text-2xl">📁</div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-blue-600">Projects</p>
                          <p className="text-2xl font-bold text-blue-900">{projects.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-6">
                      <div className="flex items-center">
                        <div className="text-2xl">🕷️</div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-green-600">Crawls</p>
                          <p className="text-2xl font-bold text-green-900">{crawls.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-6">
                      <div className="flex items-center">
                        <div className="text-2xl">📄</div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-purple-600">Pages</p>
                          <p className="text-2xl font-bold text-purple-900">
                            {crawls.reduce((sum, crawl) => sum + (crawl.pages_count || 0), 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-6">
                      <div className="flex items-center">
                        <div className="text-2xl">🧩</div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-orange-600">Chunks</p>
                          <p className="text-2xl font-bold text-orange-900">
                            {crawls.reduce((sum, crawl) => sum + (crawl.chunks_count || 0), 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tree Map Visualization */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Content Distribution</h3>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <TreeMap
                        data={generateTreeMapData()}
                        width={800}
                        height={300}
                        onNodeClick={handleTreeMapNodeClick}
                      />
                      <div className="mt-4 flex justify-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                          Projects
                        </div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                          Crawls
                        </div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
                          Pages
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Crawls */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Crawls</h3>
                    <div className="space-y-3">
                      {crawls.slice(0, 5).map(crawl => (
                        <div key={crawl.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-lg">{getScopeIcon(crawl.scope)}</span>
                              <div>
                                <p className="font-medium text-gray-900">{crawl.root_url}</p>
                                <p className="text-sm text-gray-500">
                                  {crawl.pages_count} pages • {crawl.chunks_count} chunks • {crawl.scope} scope
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(crawl.status)}`}>
                                {crawl.status}
                              </span>
                              <Link
                                href={`/dashboard/crawls/${crawl.id}`}
                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                              >
                                View Details
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Search Results Tab */}
              {activeTab === 'search' && (
                <div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Search Error</h3>
                          <div className="mt-2 text-sm text-red-700">{error}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {searchResults.length > 0 ? (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Search Results ({searchResults.length})
                      </h3>
                      <div className="space-y-4">
                        {searchResults.map((result, index) => (
                          <div key={result.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {result.page_title || 'Untitled'}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {result.page_url}
                                </p>
                                <p className="text-sm text-gray-700 mt-2">
                                  {result.content.substring(0, 200)}
                                  {result.content.length > 200 && '...'}
                                </p>
                              </div>
                              <div className="ml-4 text-right">
                                <div className="text-xs text-gray-500">
                                  <div>Combined: {result.combined_score.toFixed(3)}</div>
                                  <div>Semantic: {result.similarity_score.toFixed(3)}</div>
                                  <div>Keyword: {result.keyword_score.toFixed(3)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No search results</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Enter a search query above to find content in your knowledge base.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Browse Content Tab */}
              {activeTab === 'browse' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Browse by Project</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => {
                      const projectCrawls = crawls.filter(crawl => crawl.project_id === project.id)
                      const totalPages = projectCrawls.reduce((sum, crawl) => sum + (crawl.pages_count || 0), 0)
                      const totalChunks = projectCrawls.reduce((sum, crawl) => sum + (crawl.chunks_count || 0), 0)

                      return (
                        <div key={project.id} className="bg-gray-50 rounded-lg p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            {project.name}
                          </h4>
                          {project.description && (
                            <p className="text-gray-600 text-sm mb-4">
                              {project.description}
                            </p>
                          )}
                          <div className="text-xs text-gray-500 mb-4">
                            <div>{projectCrawls.length} crawls</div>
                            <div>{totalPages} pages</div>
                            <div>{totalChunks} chunks</div>
                          </div>
                          <div className="flex space-x-2">
                            <Link
                              href={`/dashboard/projects/${project.id}`}
                              className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                            >
                              View Project
                            </Link>
                            <button
                              onClick={() => {
                                setSelectedProject(project.id)
                                setActiveTab('search')
                              }}
                              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                            >
                              Search
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
