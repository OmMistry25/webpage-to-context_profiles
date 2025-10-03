import { createClientWithAuth, getUserFromToken } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Extract Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    console.log('Received auth header:', authHeader ? 'Present' : 'Missing')
    console.log('Token length:', token?.length || 0)
    console.log('Token preview:', token?.substring(0, 50) + '...')
    
    if (!token) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      )
    }

    // Try to decode the JWT token manually first to see if it's valid
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payload = JSON.parse(atob(parts[1]))
      console.log('JWT payload:', payload)
      console.log('JWT expires at:', new Date(payload.exp * 1000).toLocaleString())
      console.log('Current time:', new Date().toLocaleString())
      console.log('Token exp timestamp:', payload.exp)
      console.log('Current timestamp:', Math.floor(Date.now() / 1000))
      
      // Add 5 minute buffer for token expiration
      const bufferTime = 5 * 60 // 5 minutes in seconds
      if (payload.exp && payload.exp < (Date.now() / 1000) + bufferTime) {
        console.log('Token is expired or will expire soon')
        throw new Error('Token expired or expiring soon')
      }
    } catch (decodeError) {
      console.error('JWT decode error:', decodeError)
      
      // If token is expired, try to refresh it
      if (decodeError.message.includes('expired')) {
        return NextResponse.json(
          { error: 'Token expired - please refresh session', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      )
    }

    // Create Supabase client with the token directly
    const supabase = createClientWithAuth(request)
    
    // Try to get user from the client
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('User validation failed:', userError)
      return NextResponse.json(
        { error: 'Invalid token or user not found' },
        { status: 401 }
      )
    }
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, description, created_at')
      .eq('owner', user.id)
      .order('created_at', { ascending: false })

    if (projectsError) {
      console.error('Projects fetch error:', projectsError)
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${projects?.length || 0} projects for user ${user.email}`)
    return NextResponse.json(projects || [])

  } catch (error) {
    console.error('❌ Projects API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
