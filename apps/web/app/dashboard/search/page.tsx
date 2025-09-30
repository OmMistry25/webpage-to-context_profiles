'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase/client'

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

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchOptions, setSearchOptions] = useState({
    limit: 10,
    semanticWeight: 0.7,
    keywordWeight: 0.3
  })

  const supabase = createClient()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      // Get the current session to include auth token
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
          query: query.trim(),
          ...searchOptions
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data: SearchResponse = await response.json()
      setResults(data.results)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Base Search</h1>
            <p className="mt-1 text-sm text-gray-600">
              Search through your crawled content using semantic and keyword search
            </p>
          </div>

          <div className="p-6">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label htmlFor="query" className="block text-sm font-medium text-gray-700">
                  Search Query
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter your search query..."
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {/* Search Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="limit" className="block text-sm font-medium text-gray-700">
                    Results Limit
                  </label>
                  <input
                    type="number"
                    id="limit"
                    min="1"
                    max="50"
                    value={searchOptions.limit}
                    onChange={(e) => setSearchOptions(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="semanticWeight" className="block text-sm font-medium text-gray-700">
                    Semantic Weight
                  </label>
                  <input
                    type="number"
                    id="semanticWeight"
                    min="0"
                    max="1"
                    step="0.1"
                    value={searchOptions.semanticWeight}
                    onChange={(e) => setSearchOptions(prev => ({ ...prev, semanticWeight: parseFloat(e.target.value) }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="keywordWeight" className="block text-sm font-medium text-gray-700">
                    Keyword Weight
                  </label>
                  <input
                    type="number"
                    id="keywordWeight"
                    min="0"
                    max="1"
                    step="0.1"
                    value={searchOptions.keywordWeight}
                    onChange={(e) => setSearchOptions(prev => ({ ...prev, keywordWeight: parseFloat(e.target.value) }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </form>

            {/* Error Display */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
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

            {/* Results */}
            {results.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Search Results ({results.length})
                </h2>
                <div className="space-y-4">
                  {results.map((result, index) => (
                    <div key={result.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {result.page_title || 'Untitled'}
                          </h3>
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
            )}

            {/* No Results */}
            {!loading && results.length === 0 && query && !error && (
              <div className="mt-6 text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your search query or search parameters.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
