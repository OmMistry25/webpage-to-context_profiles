'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../lib/hooks/useAuth'

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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching projects:', error)
    } else {
      console.log('Fetched projects:', data)
      setProjects(data || [])
    }
  }

  useEffect(() => {
    console.log('Dashboard useEffect - authLoading:', authLoading, 'user:', user?.email)
    console.log('Document cookies on dashboard load:', document.cookie)
    console.log('LocalStorage on dashboard load:', localStorage)
    
    // Temporarily bypass auth check to see if dashboard loads
    console.log('Temporarily bypassing auth check for debugging...')
    fetchProjects().then(() => setLoading(false))
    
    // if (authLoading) {
    //   console.log('Still loading auth, waiting...')
    //   return
    // }

    // if (!user) {
    //   console.log('No user found, redirecting to login')
    //   router.push('/auth/login')
    //   return
    // }

    // console.log('User found, fetching projects')
    // // Fetch user's projects
    // fetchProjects().then(() => setLoading(false))
  }, [user, authLoading, router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim() || !user) return

    setCreateLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            name: projectName.trim(),
            description: projectDescription.trim() || null,
            owner: user.id, // Explicitly set the owner to current user
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Error creating project:', error)
        alert(`Failed to create project: ${error.message}`)
      } else {
        // Add the new project to the list
        setProjects(prev => [data, ...prev])
        // Reset form and close modal
        setProjectName('')
        setProjectDescription('')
        setShowCreateModal(false)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user.email}</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/dashboard/chat"
                className="bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                AI Chat
              </Link>
              <Link
                href="/dashboard/knowledge-base"
                className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Knowledge Base
              </Link>
              <Link
                href="/dashboard/search"
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Search
              </Link>
              <Link
                href="/"
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Home
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
          {/* Projects Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your Projects</h2>
              <p className="text-gray-600">Manage your web crawling projects</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create Project
            </button>
          </div>

          {/* Projects Grid */}
          {projects.length === 0 ? (
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No projects yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first project to start crawling websites
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Create Your First Project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div key={project.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-gray-600 text-sm mb-4">
                      {project.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 mb-4">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                      onClick={() => console.log('Navigating to project:', project.id)}
                    >
                      View
                    </Link>
                    <button className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300">
                      Settings
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create New Project
              </h3>
              <form onSubmit={handleCreateProject}>
                <div className="mb-4">
                  <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    id="projectName"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter project name"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="projectDescription"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter project description (optional)"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading || !projectName.trim()}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {createLoading ? 'Creating...' : 'Create Project'}
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
