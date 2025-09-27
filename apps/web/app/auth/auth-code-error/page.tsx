'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function AuthCodeError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const description = searchParams.get('description')

  const getErrorMessage = () => {
    switch (error) {
      case 'otp_expired':
        return 'The magic link has expired. Please request a new one.'
      case 'access_denied':
        return 'Access was denied. Please try signing in again.'
      case 'exchange_failed':
        return 'Failed to exchange the authentication code. Please try again.'
      case 'no_code':
        return 'No authentication code was provided. Please try signing in again.'
      default:
        return 'Sorry, we couldn\'t sign you in. The authentication link may have expired or been used already.'
    }
  }

  const getErrorDetails = () => {
    if (description) {
      return `Details: ${decodeURIComponent(description)}`
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Authentication Error
            </h2>
            <p className="text-gray-600 mb-4">
              {getErrorMessage()}
            </p>
            {getErrorDetails() && (
              <p className="text-sm text-gray-500 mb-6">
                {getErrorDetails()}
              </p>
            )}
            <div className="space-y-4">
              <Link
                href="/auth/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Try Again
              </Link>
              <Link
                href="/"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
