import { createClientWithAuth } from '../../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface PermissionRequest {
  userId: string
  clientId: string
  scopes: string[]
  filters?: {
    projectIds?: string[]
    dateRange?: { start: string; end: string }
    dataTypes?: string[]
  }
  expiresIn?: number // in seconds
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

    const body: PermissionRequest = await request.json()
    
    // Validate required fields
    if (!body.userId || !body.clientId || !body.scopes || body.scopes.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, clientId, and scopes are required' },
        { status: 400 }
      )
    }

    // Verify the client exists
    const { data: client, error: clientError } = await supabase
      .from('cli_clients')
      .select('*')
      .eq('client_id', body.clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid client ID' },
        { status: 404 }
      )
    }

    // Validate scopes against client's allowed scopes
    const invalidScopes = body.scopes.filter(scope => !client.scopes.includes(scope))
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes for this client: ${invalidScopes.join(', ')}` },
        { status: 400 }
      )
    }

    // Calculate expiration date
    const expiresAt = body.expiresIn 
      ? new Date(Date.now() + body.expiresIn * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days

    // Create or update user permission
    const { data: permission, error: permissionError } = await supabase
      .from('user_cli_permissions')
      .upsert([
        {
          user_id: body.userId,
          client_id: body.clientId,
          scopes: body.scopes,
          filters: body.filters || {},
          expires_at: expiresAt.toISOString(),
          is_active: true
        }
      ], {
        onConflict: 'user_id,client_id'
      })
      .select()
      .single()

    if (permissionError) {
      console.error('Error creating permission:', permissionError)
      return NextResponse.json(
        { error: 'Failed to create permission' },
        { status: 500 }
      )
    }

    // Log the permission grant
    await supabase.rpc('log_cli_access', {
      p_user_id: body.userId,
      p_client_id: body.clientId,
      p_action: 'grant_permission',
      p_resource: 'user_permission',
      p_resource_id: permission.id,
      p_endpoint: '/api/cli/auth/permissions',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ Permission granted: User ${body.userId} -> Client ${body.clientId}`)

    return NextResponse.json({
      success: true,
      permission: {
        id: permission.id,
        userId: permission.user_id,
        clientId: permission.client_id,
        scopes: permission.scopes,
        filters: permission.filters,
        expiresAt: permission.expires_at,
        grantedAt: permission.granted_at
      }
    })

  } catch (error) {
    console.error('❌ Permission grant failed:', error)
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

    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')

    let query = supabase
      .from('user_cli_permissions')
      .select(`
        *,
        cli_clients!inner(name, description, scopes)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data: permissions, error: permissionsError } = await query

    if (permissionsError) {
      console.error('Error fetching permissions:', permissionsError)
      return NextResponse.json(
        { error: 'Failed to fetch permissions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      permissions: permissions.map(p => ({
        id: p.id,
        clientId: p.client_id,
        clientName: p.cli_clients.name,
        clientDescription: p.cli_clients.description,
        scopes: p.scopes,
        filters: p.filters,
        expiresAt: p.expires_at,
        grantedAt: p.granted_at,
        lastUsed: p.last_used
      }))
    })

  } catch (error) {
    console.error('❌ Permission fetch failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClientWithAuth(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const permissionId = url.searchParams.get('permissionId')
    const clientId = url.searchParams.get('clientId')

    if (!permissionId && !clientId) {
      return NextResponse.json(
        { error: 'Either permissionId or clientId is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('user_cli_permissions')
      .update({ is_active: false })
      .eq('user_id', user.id)

    if (permissionId) {
      query = query.eq('id', permissionId)
    } else if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { error: deleteError } = await query

    if (deleteError) {
      console.error('Error revoking permission:', deleteError)
      return NextResponse.json(
        { error: 'Failed to revoke permission' },
        { status: 500 }
      )
    }

    // Log the permission revocation
    await supabase.rpc('log_cli_access', {
      p_user_id: user.id,
      p_client_id: clientId || 'unknown',
      p_action: 'revoke_permission',
      p_resource: 'user_permission',
      p_resource_id: permissionId || 'unknown',
      p_endpoint: '/api/cli/auth/permissions',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ Permission revoked: User ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Permission revoked successfully'
    })

  } catch (error) {
    console.error('❌ Permission revocation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
