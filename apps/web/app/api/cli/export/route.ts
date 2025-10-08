import { createClientWithAuth } from '../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { BundlerService } from '../../../../lib/bundler'

interface CLIExportRequest {
  resourceType: 'project' | 'crawl' | 'user-data'
  resourceId: string
  userId: string
  format: 'zip' | 'json' | 'csv'
  includeEmbeddings?: boolean
  includeMetadata?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClientWithAuth(request)
    
    // Extract client ID from Authorization header
    const authHeader = request.headers.get('authorization')
    const clientId = authHeader?.replace('Bearer ', '').split(':')[0] // Extract client ID from token
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const body: CLIExportRequest = await request.json()
    
    // Validate required fields
    if (!body.resourceType || !body.resourceId || !body.userId || !body.format) {
      return NextResponse.json(
        { error: 'Missing required fields: resourceType, resourceId, userId, and format are required' },
        { status: 400 }
      )
    }

    // Check rate limiting
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', {
        p_client_id: clientId,
        p_user_id: body.userId,
        p_endpoint: '/api/cli/export'
      })

    if (rateLimitError || !rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Check if client has permission to export
    const { data: hasPermission, error: permissionError } = await supabase
      .rpc('check_cli_permission', {
        p_user_id: body.userId,
        p_client_id: clientId,
        p_required_scope: 'export:data'
      })

    if (permissionError || !hasPermission) {
      await supabase.rpc('log_cli_access', {
        p_user_id: body.userId,
        p_client_id: clientId,
        p_action: 'export_denied',
        p_resource: body.resourceType,
        p_resource_id: body.resourceId,
        p_endpoint: '/api/cli/export',
        p_ip_address: request.ip || '127.0.0.1',
        p_user_agent: request.headers.get('user-agent') || '',
        p_success: false,
        p_error_message: 'Insufficient permissions'
      })

      return NextResponse.json(
        { error: 'Insufficient permissions to export user data' },
        { status: 403 }
      )
    }

    // Verify user owns the resource
    let resourceExists = false
    let resourceOwner = null

    if (body.resourceType === 'project') {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, owner')
        .eq('id', body.resourceId)
        .eq('owner', body.userId)
        .single()

      if (!projectError && project) {
        resourceExists = true
        resourceOwner = project.owner
      }
    } else if (body.resourceType === 'crawl') {
      const { data: crawl, error: crawlError } = await supabase
        .from('crawls')
        .select(`
          id, 
          projects!inner(id, owner)
        `)
        .eq('id', body.resourceId)
        .eq('projects.owner', body.userId)
        .single()

      if (!crawlError && crawl) {
        resourceExists = true
        resourceOwner = crawl.projects.owner
      }
    } else if (body.resourceType === 'user-data') {
      // For user-data, we'll export all user's data
      resourceExists = true
      resourceOwner = body.userId
    }

    if (!resourceExists) {
      return NextResponse.json(
        { error: 'Resource not found or access denied' },
        { status: 404 }
      )
    }

    // Create export using existing BundlerService
    const bundlerService = new BundlerService()
    let result

    if (body.resourceType === 'project') {
      result = await bundlerService.createBundle(body.resourceId)
    } else if (body.resourceType === 'crawl') {
      result = await bundlerService.createCrawlBundle(body.resourceId)
    } else {
      // For user-data, create a comprehensive export
      result = await bundlerService.createUserDataBundle(body.userId, {
        includeEmbeddings: body.includeEmbeddings,
        includeMetadata: body.includeMetadata,
        format: body.format
      })
    }

    // Log successful export
    await supabase.rpc('log_cli_access', {
      p_user_id: body.userId,
      p_client_id: clientId,
      p_action: 'export',
      p_resource: body.resourceType,
      p_resource_id: body.resourceId,
      p_endpoint: '/api/cli/export',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ CLI export completed: ${body.resourceType} ${body.resourceId}`)

    return NextResponse.json({
      success: true,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      format: body.format,
      downloadUrl: result.downloadUrl,
      bundleId: result.bundleId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    })

  } catch (error) {
    console.error('❌ CLI export failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
