import { createClientWithAuth } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

interface CreateAPIKeyRequest {
  name: string
  description?: string
  expiresInDays?: number
}

export async function POST(request: NextRequest) {
  try {
    console.log('API Key creation request received')
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))
    console.log('Request cookies:', request.cookies.getAll())
    
    // Get the auth token from cookies
    const authCookie = request.cookies.get('sb-mqjvhrfvrdshsdaajgut-auth-token')
    console.log('Auth cookie found:', !!authCookie)
    
    if (!authCookie) {
      console.log('No auth cookie found')
      return NextResponse.json(
        { error: 'Unauthorized - No authentication cookie' },
        { status: 401 }
      )
    }
    
    // Parse the auth token from the cookie
    let authData
    try {
      authData = JSON.parse(authCookie.value)
      console.log('Parsed auth data:', { 
        hasAccessToken: !!authData.access_token, 
        userEmail: authData.user?.email,
        expiresAt: authData.expires_at 
      })
    } catch (parseError) {
      console.log('Failed to parse auth cookie:', parseError)
      return NextResponse.json(
        { error: 'Unauthorized - Invalid authentication cookie' },
        { status: 401 }
      )
    }
    
    // Check if token is expired
    if (authData.expires_at && Date.now() / 1000 > authData.expires_at) {
      console.log('Token expired')
      return NextResponse.json(
        { error: 'Unauthorized - Token expired' },
        { status: 401 }
      )
    }
    
    // Use the user from the cookie directly
    const user = authData.user
    if (!user) {
      console.log('No user in auth data')
      return NextResponse.json(
        { error: 'Unauthorized - No user data' },
        { status: 401 }
      )
    }
    
    console.log('Authentication successful for user:', user.email)

    // Create Supabase client for database operations
    // Use service role key to bypass RLS for API key creation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body: CreateAPIKeyRequest = await request.json()
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      )
    }

    // Validate name length
    if (body.name.length < 3 || body.name.length > 50) {
      return NextResponse.json(
        { error: 'API key name must be between 3 and 50 characters' },
        { status: 400 }
      )
    }

    // Validate expiration (optional)
    let expiresAt = null
    if (body.expiresInDays) {
      if (body.expiresInDays < 1 || body.expiresInDays > 365) {
        return NextResponse.json(
          { error: 'Expiration must be between 1 and 365 days' },
          { status: 400 }
        )
      }
      expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    }

    // Generate API key
    const { data: keyData, error: keyError } = await supabase
      .rpc('generate_api_key')
      .single()

    if (keyError) {
      console.error('Error generating API key:', keyError)
      return NextResponse.json(
        { error: 'Failed to generate API key' },
        { status: 500 }
      )
    }

    // Store API key in database
    const { data: apiKey, error: insertError } = await supabase
      .from('api_keys')
      .insert([
        {
          key_name: body.name,
          key_hash: keyData.key_hash,
          key_prefix: keyData.key_prefix,
          description: body.description || '',
          created_by: user.id,
          expires_at: expiresAt
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Error storing API key:', insertError)
      return NextResponse.json(
        { error: 'Failed to store API key' },
        { status: 500 }
      )
    }

    console.log(`✅ API key created: ${apiKey.key_name} (${apiKey.key_prefix}...)`)

    return NextResponse.json({
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.key_name,
        key: keyData.key_value, // Only returned once
        prefix: apiKey.key_prefix,
        description: apiKey.description,
        expiresAt: apiKey.expires_at,
        createdAt: apiKey.created_at
      }
    })

  } catch (error) {
    console.error('❌ API key creation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClientWithAuth(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's API keys
    const { data: apiKeys, error: keysError } = await supabase
      .from('api_keys')
      .select('id, key_name, key_prefix, description, is_active, created_at, last_used_at, expires_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (keysError) {
      console.error('Error fetching API keys:', keysError)
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      apiKeys: apiKeys || []
    })

  } catch (error) {
    console.error('❌ Failed to fetch API keys:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
