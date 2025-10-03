import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: {
          getItem: (key: string) => {
            // Check if we're in browser environment
            if (typeof window === 'undefined') return null
            
            // Try localStorage first, then cookies
            try {
              const localStorageValue = localStorage.getItem(key)
              if (localStorageValue) return localStorageValue
            } catch (e) {
              // localStorage might not be available
            }
            
            // Fallback to cookies
            try {
              const cookies = document.cookie.split(';')
              for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=')
                if (name === key) return decodeURIComponent(value)
              }
            } catch (e) {
              // document might not be available
            }
            return null
          },
          setItem: (key: string, value: string) => {
            // Check if we're in browser environment
            if (typeof window === 'undefined') return
            
            // Store in both localStorage and cookies
            try {
              localStorage.setItem(key, value)
            } catch (e) {
              // localStorage might not be available
            }
            
            // Also set as cookie for server-side access
            try {
              const cookieString = `${key}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`
              document.cookie = cookieString
            } catch (e) {
              // document might not be available
            }
          },
          removeItem: (key: string) => {
            // Check if we're in browser environment
            if (typeof window === 'undefined') return
            
            try {
              localStorage.removeItem(key)
            } catch (e) {
              // localStorage might not be available
            }
            
            try {
              document.cookie = `${key}=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
            } catch (e) {
              // document might not be available
            }
          }
        }
      },
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          return document.cookie
            .split(';')
            .map(cookie => cookie.trim().split('='))
            .filter(([name]) => name)
            .map(([name, value]) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookieString = `${name}=${value}`
            if (options?.maxAge) cookieString += `; Max-Age=${options.maxAge}`
            if (options?.path) cookieString += `; Path=${options.path}`
            if (options?.domain) cookieString += `; Domain=${options.domain}`
            if (options?.secure) cookieString += `; Secure`
            if (options?.httpOnly) cookieString += `; HttpOnly`
            if (options?.sameSite) cookieString += `; SameSite=${options.sameSite}`
            document.cookie = cookieString
          })
        },
      },
    }
  )
}
