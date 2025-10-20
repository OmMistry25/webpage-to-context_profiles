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

    // Verify the authorization code
    let authCodeData
    try {
      const decoded = Buffer.from(body.code, 'base64').toString('utf-8')
      const parts = decoded.split(':')
      if (parts.length !== 4) {
        throw new Error('Invalid authorization code format')
      }
      authCodeData = {
        userId: parts[0],
        clientId: parts[1],
        timestamp: parseInt(parts[2]),
        random: parts[3]
      }
    } catch (error) {
      console.error('Invalid authorization code:', error)
      return NextResponse.json(
        { error: 'Invalid authorization code' },
        { status: 400 }
      )
    }

    // Check if authorization code is expired (5 minutes)
    const now = Date.now()
    const codeAge = now - authCodeData.timestamp
    if (codeAge > 5 * 60 * 1000) { // 5 minutes
      return NextResponse.json(
        { error: 'Authorization code expired' },
        { status: 400 }
      )
    }

    // Verify the client ID matches
    if (authCodeData.clientId !== body.clientId) {
      return NextResponse.json(
        { error: 'Authorization code client mismatch' },
        { status: 400 }
      )
    }

    // Check if user has granted permissions to this client
    const { data: permission, error: permError } = await supabase
      .from('user_cli_permissions')
      .select('*')
      .eq('user_id', authCodeData.userId)
      .eq('client_id', body.clientId)
      .eq('granted', true)
      .single()

    if (permError || !permission) {
      console.error('No permission found:', permError)
      return NextResponse.json(
        { error: 'Access not granted by user' },
        { status: 403 }
      )
    }

    // Generate access token (in production, use proper JWT)
    const accessToken = Buffer.from(`${authCodeData.userId}:${body.clientId}:${now}:${Math.random()}`).toString('base64')
    const expiresIn = 3600 // 1 hour
    const tokenType = 'Bearer'

    // Log the token request
    await supabase.rpc('log_cli_access', {
      p_user_id: authCodeData.userId,
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
