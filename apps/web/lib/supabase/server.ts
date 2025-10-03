import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export function createClientWithAuth(request: NextRequest) {
  const cookieStore = cookies()
  
  // Extract Authorization header if present
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      global: {
        headers: token ? {
          Authorization: `Bearer ${token}`
        } : {}
      }
    }
  )
}

// Alternative function that uses the token directly with Supabase client
export async function getUserFromToken(token: string) {
  console.log('Validating token:', token.substring(0, 20) + '...')
  
  // Create a Supabase client with the service role key for token validation
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  )
  
  // Try to get the user
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.log('Token validation error:', error.message)
    throw new Error(`Invalid token: ${error.message}`)
  }
  
  if (!user) {
    console.log('No user found for token')
    throw new Error('No user found for token')
  }
  
  console.log('Token validation successful, user:', user.email)
  return { user }
}
