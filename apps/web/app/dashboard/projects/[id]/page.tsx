'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../../../lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  email?: string
}

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

interface Crawl {
  id: string
  project_id: string
  root_url: string
  scope: string
  max_depth: number
  max_pages: number
  status: string
  robots_checked: boolean
  sitemap_checked: boolean
  estimated_pages: number | null
  pages_crawled: number
  pages_failed: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface CrawlStats {
  total_crawls: number
  completed_crawls: number
  running_crawls: number
  failed_crawls: number
  total_pages: number
  total_failed_pages: number
}

export default function ProjectDetailPage() {
  const [user, setUser] = useState<User | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [crawls, setCrawls] = useState<Crawl[]>([])
  const [crawlStats, setCrawlStats] = useState<CrawlStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCrawlModal, setShowCrawlModal] = useState(false)
  const [crawlLoading, setCrawlLoading] = useState(false)
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawlScope, setCrawlScope] = useState('domain')
  const [crawlMaxDepth, setCrawlMaxDepth] = useState(3)
  const [crawlMaxPages, setCrawlMaxPages] = useState(100)
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  console.log('ProjectDetailPage rendered with projectId:', projectId)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch project and related data
      await fetchProjectData()
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/auth/login')
        } else {
          setUser(session.user)
          if (session.user) {
            fetchProjectData()
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase.auth, projectId])

  // Separate useEffect to fetch project data when user or projectId changes
  useEffect(() => {
    console.log('useEffect triggered - user:', user?.id, 'projectId:', projectId)
    if (user && projectId) {
      console.log('Calling fetchProjectData...')
      fetchProjectData()
    }
  }, [user, projectId])

  const fetchProjectData = async () => {
    if (!user || !projectId) return

    try {
      console.log('Fetching project with ID:', projectId)
      console.log('User ID:', user.id)
      
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      console.log('Project query result:', { projectData, projectError })

      if (projectError) {
        console.error('Error fetching project:', projectError)
        setError(`Project not found or access denied: ${projectError.message}`)
        return
      }

      setProject(projectData)

      // Fetch crawls for this project
      const { data: crawlsData, error: crawlsError } = await supabase
        .from('crawls')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (crawlsError) {
        console.error('Error fetching crawls:', crawlsError)
      } else {
        setCrawls(crawlsData || [])
      }

      // Calculate crawl statistics
      const stats: CrawlStats = {
        total_crawls: crawlsData?.length || 0,
        completed_crawls: crawlsData?.filter(c => c.status === 'completed').length || 0,
        running_crawls: crawlsData?.filter(c => c.status === 'running').length || 0,
        failed_crawls: crawlsData?.filter(c => c.status === 'failed').length || 0,
        total_pages: crawlsData?.reduce((sum, c) => sum + c.pages_crawled, 0) || 0,
        total_failed_pages: crawlsData?.reduce((sum, c) => sum + c.pages_failed, 0) || 0,
      }
      setCrawlStats(stats)

    } catch (error) {
      console.error('Error fetching project data:', error)
      setError('Failed to load project data')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!crawlUrl.trim() || !projectId) return

    setCrawlLoading(true)
    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          root_url: crawlUrl.trim(),
          scope: crawlScope,
          max_depth: crawlMaxDepth,
          max_pages: crawlMaxPages,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start crawl')
      }

      // Refresh the crawls data
      await fetchProjectData()
      
      // Reset form and close modal
      setCrawlUrl('')
      setCrawlScope('domain')
      setCrawlMaxDepth(3)
      setCrawlMaxPages(100)
      setShowCrawlModal(false)

      console.log('Crawl started successfully:', data)
    } catch (error) {
      console.error('Error starting crawl:', error)
      alert(`Failed to start crawl: ${error.message}`)
    } finally {
      setCrawlLoading(false)
    }
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
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The project you are looking for does not exist.'}</p>
          <Link
            href="/dashboard"
            className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-gray-600 mt-1">{project.description}</p>
              )}
            </div>
            <div className="flex space-x-4">
              <Link
                href="/dashboard"
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Dashboard
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
          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="flex space-x-4">
              <button 
                onClick={() => setShowCrawlModal(true)}
                className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Start New Crawl
              </button>
              <button className="bg-gray-200 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Export Data
              </button>
              <button className="bg-gray-200 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Settings
              </button>
            </div>
          </div>

          {/* Statistics */}
          {crawlStats && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Crawl Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-2xl font-bold text-gray-900">{crawlStats.total_crawls}</div>
                  <div className="text-sm text-gray-600">Total Crawls</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-2xl font-bold text-green-600">{crawlStats.completed_crawls}</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-2xl font-bold text-blue-600">{crawlStats.running_crawls}</div>
                  <div className="text-sm text-gray-600">Running</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-2xl font-bold text-gray-900">{crawlStats.total_pages}</div>
                  <div className="text-sm text-gray-600">Pages Crawled</div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Crawls */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Crawls</h2>
            {crawls.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No crawls yet</h3>
                <p className="text-gray-600 mb-4">Start your first crawl to begin collecting data from websites.</p>
                <button 
                  onClick={() => setShowCrawlModal(true)}
                  className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Start First Crawl
                </button>
              </div>
            ) : (
              <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          URL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pages
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Started
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {crawls.map((crawl) => (
                        <tr key={crawl.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {crawl.root_url}
                            </div>
                            <div className="text-sm text-gray-500">
                              Depth: {crawl.max_depth} • Max: {crawl.max_pages}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(crawl.status)}`}>
                              {crawl.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {crawl.pages_crawled} / {crawl.estimated_pages || '?'}
                            {crawl.pages_failed > 0 && (
                              <div className="text-red-600 text-xs">
                                {crawl.pages_failed} failed
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {crawl.started_at ? new Date(crawl.started_at).toLocaleDateString() : 'Not started'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                              View
                            </button>
                            <button className="text-red-600 hover:text-red-900">
                              Stop
                            </button>
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

      {/* Start Crawl Modal */}
      {showCrawlModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Start New Crawl
              </h3>
              <form onSubmit={handleStartCrawl}>
                <div className="mb-4">
                  <label htmlFor="crawlUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL *
                  </label>
                  <input
                    type="url"
                    id="crawlUrl"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="https://example.com"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="crawlScope" className="block text-sm font-medium text-gray-700 mb-2">
                    Crawl Scope
                  </label>
                  <select
                    id="crawlScope"
                    value={crawlScope}
                    onChange={(e) => setCrawlScope(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="domain">Domain (example.com)</option>
                    <option value="subdomain">Subdomain (sub.example.com)</option>
                    <option value="path">Path (/specific/path)</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label htmlFor="crawlMaxDepth" className="block text-sm font-medium text-gray-700 mb-2">
                    Max Depth
                  </label>
                  <input
                    type="number"
                    id="crawlMaxDepth"
                    min="1"
                    max="10"
                    value={crawlMaxDepth}
                    onChange={(e) => setCrawlMaxDepth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="mb-6">
                  <label htmlFor="crawlMaxPages" className="block text-sm font-medium text-gray-700 mb-2">
                    Max Pages
                  </label>
                  <input
                    type="number"
                    id="crawlMaxPages"
                    min="1"
                    max="10000"
                    value={crawlMaxPages}
                    onChange={(e) => setCrawlMaxPages(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCrawlModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={crawlLoading || !crawlUrl.trim()}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {crawlLoading ? 'Starting...' : 'Start Crawl'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
