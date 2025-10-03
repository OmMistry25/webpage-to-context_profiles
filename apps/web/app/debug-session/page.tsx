'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { User } from '@supabase/supabase-js'

export default function DebugSessionPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Session error:', error)
        } else {
          console.log('Session data:', session)
          setSession(session)
          setUser(session?.user || null)
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session)
      setSession(session)
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Session</h1>
      <div>
        <h2>User:</h2>
        <pre>{JSON.stringify(user, null, 2)}</pre>
      </div>
      <div>
        <h2>Session:</h2>
        <pre>{JSON.stringify(session, null, 2)}</pre>
      </div>
      <div>
        <h2>Cookies:</h2>
        <pre>{document.cookie}</pre>
      </div>
      <div>
        <h2>Local Storage:</h2>
        <pre>{JSON.stringify(localStorage, null, 2)}</pre>
      </div>
    </div>
  )
}
