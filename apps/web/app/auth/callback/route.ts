import { createClient } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/dashboard'

  // Handle OAuth errors
  if (error) {
    console.log('Auth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error}&description=${errorDescription}`)
  }

  if (code) {
    const supabase = createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.log('Exchange error:', exchangeError)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_failed&description=${exchangeError.message}`)
    }
    
    if (data.session) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code&description=No authentication code provided`)
}
