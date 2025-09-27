'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../../../lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  email?: string
}

interface Crawl {
  id: string
  project_id: string
  project_name: string
  root_url: string
  scope: string
  max_depth: number
  max_pages: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  pages_crawled: number
  pages_failed: number
  total_pages: number
  successful_pages: number
  failed_pages: number
  total_chunks: number
  progress_percentage: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface Page {
  id: string
  crawl_id: string
  url: string
  title: string | null
  status: 'pending' | 'success' | 'failed'
  content_length: number | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface CrawlStatistics {
  total_pages: number
  successful_pages: number
  failed_pages: number
  total_chunks: number
  progress_percentage: number
}

export default function CrawlDetailPage() {
  const [user, setUser] = useState<User | null>(null)
  const [crawl, setCrawl] = useState<Crawl | null>(null)
  const [pages, setPages] = useState<Page[]>([])
  const [statistics, setStatistics] = useState<CrawlStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const crawlId = params.id as string
  const supabase = createClient()

  console.log('CrawlDetailPage rendered with crawlId:', crawlId)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/auth/login')
        } else {
          setUser(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase.auth, crawlId])

  // Separate useEffect to fetch crawl data when user or crawlId changes
  useEffect(() => {
    console.log('useEffect triggered - user:', user?.id, 'crawlId:', crawlId)
    if (user && crawlId) {
      console.log('Calling fetchCrawlData...')
      fetchCrawlData()
    }
  }, [user, crawlId])

  const fetchCrawlData = async () => {
    if (!user || !crawlId) return

    try {
      console.log('Fetching crawl with ID:', crawlId)
      console.log('User ID:', user.id)
      
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/crawl/${crawlId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      console.log('Crawl API response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch crawl')
      }

      setCrawl(data.crawl)
      setPages(data.pages || [])
      setStatistics(data.statistics || null)

    } catch (err) {
      console.error('Error fetching crawl data:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!crawl) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Crawl Not Found
              </h2>
              <p className="text-gray-600 mb-4">
                The crawl you are looking for does not exist.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Crawl Details</h1>
              <p className="text-gray-600">
                {crawl.project_name} • {crawl.root_url}
              </p>
            </div>
            <div className="flex space-x-4">
              <Link
                href={`/dashboard/projects/${crawl.project_id}`}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Project
              </Link>
              <Link
                href="/dashboard"
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="bg-red-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Crawl Information */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Crawl Information</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full mt-1 ${getStatusColor(crawl.status)}`}>
                    {crawl.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Root URL</label>
                  <p className="mt-1 text-sm text-gray-900 break-all">{crawl.root_url}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Scope</label>
                  <p className="mt-1 text-sm text-gray-900">{crawl.scope}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Max Depth</label>
                  <p className="mt-1 text-sm text-gray-900">{crawl.max_depth}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Max Pages</label>
                  <p className="mt-1 text-sm text-gray-900">{crawl.max_pages}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Progress</label>
                  <p className="mt-1 text-sm text-gray-900">{crawl.progress_percentage}%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Started</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {crawl.started_at ? new Date(crawl.started_at).toLocaleString() : 'Not started'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Completed</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {crawl.completed_at ? new Date(crawl.completed_at).toLocaleString() : 'Not completed'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Created</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(crawl.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {crawl.error_message && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-500">Error Message</label>
                  <p className="mt-1 text-sm text-red-600 bg-red-50 p-3 rounded-md">{crawl.error_message}</p>
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Statistics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                  <p className="text-sm font-medium text-gray-500">Total Pages</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {statistics.total_pages}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                  <p className="text-sm font-medium text-gray-500">Successful</p>
                  <p className="mt-1 text-3xl font-semibold text-green-600">
                    {statistics.successful_pages}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                  <p className="text-sm font-medium text-gray-500">Failed</p>
                  <p className="mt-1 text-3xl font-semibold text-red-600">
                    {statistics.failed_pages}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                  <p className="text-sm font-medium text-gray-500">Total Chunks</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {statistics.total_chunks}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pages */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Crawled Pages</h2>
            {pages.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pages crawled yet</h3>
                <p className="text-gray-600">Pages will appear here once the crawl starts processing.</p>
              </div>
            ) : (
              <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          URL
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Content Length
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pages.map((page) => (
                        <tr key={page.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {page.url}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 truncate max-w-xs">
                              {page.title || 'No title'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(page.status)}`}>
                              {page.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {page.content_length ? `${page.content_length} chars` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(page.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
