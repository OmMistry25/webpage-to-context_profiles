import { createClientWithAuth } from '../../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface TokenRequest {
  clientId: string
  clientSecret: string
  code: string
  grantType: string
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenRequest = await request.json()
    
    // Validate required fields
    if (!body.clientId || !body.clientSecret || !body.code || !body.grantType) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, clientSecret, code, and grantType are required' },
        { status: 400 }
      )
    }

    if (body.grantType !== 'authorization_code') {
      return NextResponse.json(
        { error: 'Unsupported grant type. Only authorization_code is supported' },
        { status: 400 }
      )
    }

    const supabase = createClientWithAuth(request)

    // Verify client credentials
    const { data: client, error: clientError } = await supabase
      .from('cli_clients')
      .select('*')
      .eq('client_id', body.clientId)
      .eq('client_secret', body.clientSecret)
      .single()

    if (clientError || !client) {
      console.error('Invalid client credentials:', clientError)
      return NextResponse.json(
        { error: 'Invalid client credentials' },
        { status: 401 }
      )
    }

    // In a real implementation, you would:
    // 1. Verify the authorization code
    // 2. Check if it's expired
    // 3. Exchange it for an access token
    
    // For now, we'll create a simple access token
    // In production, use proper JWT tokens or OAuth 2.0 flow
    
    const accessToken = Buffer.from(`${body.clientId}:${Date.now()}:${Math.random()}`).toString('base64')
    const expiresIn = 3600 // 1 hour
    const tokenType = 'Bearer'

    // Log the token request
    await supabase.rpc('log_cli_access', {
      p_user_id: null, // We don't have user context yet
      p_client_id: body.clientId,
      p_action: 'token_request',
      p_resource: 'access_token',
      p_resource_id: accessToken,
      p_endpoint: '/api/cli/auth/token',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ Access token generated for client: ${client.name}`)

    return NextResponse.json({
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      scope: client.scopes.join(' ')
    })

  } catch (error) {
    console.error('❌ Token request failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
