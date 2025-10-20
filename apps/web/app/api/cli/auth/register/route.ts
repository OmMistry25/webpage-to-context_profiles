import { createClientWithAuth } from '../../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface CLIRegistrationRequest {
  name: string
  description: string
  redirectUri: string
  scopes: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClientWithAuth(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: CLIRegistrationRequest = await request.json()
    
    // Validate required fields
    if (!body.name || !body.redirectUri || !body.scopes || body.scopes.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, redirectUri, and scopes are required' },
        { status: 400 }
      )
    }

    // Validate scopes
    const validScopes = [
      'read:projects',
      'read:crawls', 
      'read:chunks',
      'search:chunks',
      'export:data',
      'read:metadata'
    ]
    
    const invalidScopes = body.scopes.filter(scope => !validScopes.includes(scope))
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate client credentials
    const { data: credentials, error: credError } = await supabase
      .rpc('generate_client_credentials')
      .single()

    if (credError) {
      console.error('Error generating credentials:', credError)
      return NextResponse.json(
        { error: 'Failed to generate client credentials' },
        { status: 500 }
      )
    }

    // Create CLI client
    const { data: client, error: clientError } = await supabase
      .from('cli_clients')
      .insert([
        {
          name: body.name,
          description: body.description || '',
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
          redirect_uri: body.redirectUri,
          scopes: body.scopes,
          created_by: user.id
        }
      ])
      .select()
      .single()

    if (clientError) {
      console.error('Error creating CLI client:', clientError)
      return NextResponse.json(
        { error: 'Failed to create CLI client' },
        { status: 500 }
      )
    }

    // Log the registration
    await supabase.rpc('log_cli_access', {
      p_user_id: user.id,
      p_client_id: credentials.client_id,
      p_action: 'register',
      p_resource: 'cli_client',
      p_resource_id: client.id,
      p_endpoint: '/api/cli/auth/register',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ CLI client registered: ${client.name} (${credentials.client_id})`)

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        description: client.description,
        clientId: client.client_id,
        clientSecret: client.client_secret,
        redirectUri: client.redirect_uri,
        scopes: client.scopes,
        createdAt: client.created_at
      }
    })

  } catch (error) {
    console.error('❌ CLI registration failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
