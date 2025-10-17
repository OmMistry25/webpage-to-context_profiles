'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'

interface CLIClient {
  id: string
  name: string
  description: string
  scopes: string[]
  created_at: string
}

const scopeDescriptions: Record<string, string> = {
  'read:projects': 'Read your project information and metadata',
  'read:crawls': 'Read your crawl history and status',
  'read:chunks': 'Read content chunks from your crawled pages',
  'search:chunks': 'Search through your content chunks',
  'export:data': 'Export your data in various formats',
  'read:metadata': 'Read metadata about your projects and crawls'
}

export default function CLIConsentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [client, setClient] = useState<CLIClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const scope = searchParams.get('scope')
  const state = searchParams.get('state')

  useEffect(() => {
    if (!clientId) {
      setError('Missing client_id parameter')
      setLoading(false)
      return
    }

    fetchClientInfo()
  }, [clientId])

  const fetchClientInfo = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      // For now, we'll create a mock client since we don't have a public endpoint
      // In production, you'd have a public endpoint to get client info
      const mockClient: CLIClient = {
        id: clientId!,
        name: 'CLI Client',
        description: 'A command-line interface client requesting access to your data',
        scopes: scope?.split(',') || [],
        created_at: new Date().toISOString()
      }
      
      setClient(mockClient)
    } catch (err) {
      console.error('Error fetching client info:', err)
      setError('Failed to load client information')
    } finally {
      setLoading(false)
    }
  }

  const handleConsent = async (granted: boolean) => {
    if (!client) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/cli/auth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: scope,
          state: state,
          user_decision: granted
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Redirect back to client with authorization code
        const redirectUrl = new URL(redirectUri!)
        redirectUrl.searchParams.set('code', result.authorization_code)
        if (state) redirectUrl.searchParams.set('state', state)
        
        window.location.href = redirectUrl.toString()
      } else {
        setError(result.error || 'Failed to process consent')
      }
    } catch (err) {
      console.error('Error processing consent:', err)
      setError('Failed to process consent')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading client information...</p>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Error</div>
          <p className="text-gray-600">{error || 'Client not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Authorize CLI Access
            </h1>
            <p className="text-gray-600">
              A CLI application is requesting access to your data
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Application Details
            </h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">{client.name}</p>
              <p className="text-sm text-gray-600 mt-1">{client.description}</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Requested Permissions
            </h2>
            <div className="space-y-2">
              {client.scopes.map((scope) => (
                <div key={scope} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{scope}</p>
                    <p className="text-xs text-gray-600">
                      {scopeDescriptions[scope] || 'No description available'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              What this means
            </h2>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                By granting access, you allow this CLI application to access your data 
                according to the permissions listed above. You can revoke this access 
                at any time from your dashboard.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={() => handleConsent(false)}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Processing...' : 'Deny'}
            </button>
            <button
              onClick={() => handleConsent(true)}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Processing...' : 'Allow'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel and return to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
