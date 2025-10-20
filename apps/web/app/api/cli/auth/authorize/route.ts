import { createClientWithAuth } from '../../../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const redirectUri = searchParams.get('redirect_uri')
    const scope = searchParams.get('scope')
    const state = searchParams.get('state')

    // Validate required parameters
    if (!clientId || !redirectUri || !scope) {
      return NextResponse.json(
        { error: 'Missing required parameters: client_id, redirect_uri, and scope are required' },
        { status: 400 }
      )
    }

    const supabase = createClientWithAuth(request)

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('cli_clients')
      .select('*')
      .eq('client_id', clientId)
      .single()

    if (clientError || !client) {
      console.error('Invalid client ID:', clientError)
      return NextResponse.json(
        { error: 'Invalid client_id' },
        { status: 400 }
      )
    }

    // Verify redirect URI matches
    if (client.redirect_uri !== redirectUri) {
      return NextResponse.json(
        { error: 'Invalid redirect_uri' },
        { status: 400 }
      )
    }

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      // Redirect to login page with return URL
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('return_to', request.url)
      return NextResponse.redirect(loginUrl.toString())
    }

    // Check if user has already granted permissions to this client
    const { data: existingPermission, error: permError } = await supabase
      .from('user_cli_permissions')
      .select('*')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single()

    if (permError && permError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking permissions:', permError)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }

    // If no existing permission, redirect to consent page
    if (!existingPermission) {
      const consentUrl = new URL('/dashboard/cli-consent', request.url)
      consentUrl.searchParams.set('client_id', clientId)
      consentUrl.searchParams.set('redirect_uri', redirectUri)
      consentUrl.searchParams.set('scope', scope)
      if (state) consentUrl.searchParams.set('state', state)
      return NextResponse.redirect(consentUrl.toString())
    }

    // If permission exists and is granted, generate authorization code
    if (existingPermission.granted) {
      // Generate authorization code
      const authCode = Buffer.from(`${user.id}:${clientId}:${Date.now()}:${Math.random()}`).toString('base64')
      
      // Store authorization code temporarily (in production, use Redis or similar)
      // For now, we'll just return it directly
      
      // Log the authorization
      await supabase.rpc('log_cli_access', {
        p_user_id: user.id,
        p_client_id: clientId,
        p_action: 'authorize',
        p_resource: 'authorization_code',
        p_resource_id: authCode,
        p_endpoint: '/api/cli/auth/authorize',
        p_ip_address: request.ip || '127.0.0.1',
        p_user_agent: request.headers.get('user-agent') || '',
        p_success: true
      })

      // Redirect back to client with authorization code
      const redirectUrl = new URL(redirectUri)
      redirectUrl.searchParams.set('code', authCode)
      if (state) redirectUrl.searchParams.set('state', state)
      
      return NextResponse.redirect(redirectUrl.toString())
    }

    // Permission exists but not granted
    return NextResponse.json(
      { error: 'Access denied by user' },
      { status: 403 }
    )

  } catch (error) {
    console.error('❌ Authorization failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_id, redirect_uri, scope, state, user_decision } = body

    // Validate required fields
    if (!client_id || !redirect_uri || !scope || user_decision === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClientWithAuth(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Update or create user permission
    const { error: permError } = await supabase
      .from('user_cli_permissions')
      .upsert({
        user_id: user.id,
        client_id: client_id,
        scopes: scope.split(','),
        granted: user_decision,
        updated_at: new Date().toISOString()
      })

    if (permError) {
      console.error('Error updating permissions:', permError)
      return NextResponse.json(
        { error: 'Failed to update permissions' },
        { status: 500 }
      )
    }

    if (user_decision) {
      // Generate authorization code
      const authCode = Buffer.from(`${user.id}:${client_id}:${Date.now()}:${Math.random()}`).toString('base64')
      
      // Log the authorization
      await supabase.rpc('log_cli_access', {
        p_user_id: user.id,
        p_client_id: client_id,
        p_action: 'authorize',
        p_resource: 'authorization_code',
        p_resource_id: authCode,
        p_endpoint: '/api/cli/auth/authorize',
        p_ip_address: request.ip || '127.0.0.1',
        p_user_agent: request.headers.get('user-agent') || '',
        p_success: true
      })

      return NextResponse.json({
        success: true,
        authorization_code: authCode,
        redirect_uri: redirect_uri,
        state: state
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Access denied by user'
      })
    }

  } catch (error) {
    console.error('❌ Authorization consent failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
