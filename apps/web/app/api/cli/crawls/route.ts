import { createClientWithAuth } from '../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const projectId = url.searchParams.get('projectId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      )
    }

    // Check rate limiting
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', {
        p_client_id: clientId,
        p_user_id: userId,
        p_endpoint: '/api/cli/crawls'
      })

    if (rateLimitError || !rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Check if client has permission to read crawls
    const { data: hasPermission, error: permissionError } = await supabase
      .rpc('check_cli_permission', {
        p_user_id: userId,
        p_client_id: clientId,
        p_required_scope: 'read:crawls'
      })

    if (permissionError || !hasPermission) {
      await supabase.rpc('log_cli_access', {
        p_user_id: userId,
        p_client_id: clientId,
        p_action: 'list_crawls_denied',
        p_resource: 'crawls',
        p_resource_id: userId,
        p_endpoint: '/api/cli/crawls',
        p_ip_address: request.ip || '127.0.0.1',
        p_user_agent: request.headers.get('user-agent') || '',
        p_success: false,
        p_error_message: 'Insufficient permissions'
      })

      return NextResponse.json(
        { error: 'Insufficient permissions to read crawls' },
        { status: 403 }
      )
    }

    // Build query for user's crawls
    let query = supabase
      .from('crawls')
      .select(`
        id,
        root_url,
        scope,
        max_depth,
        max_pages,
        status,
        pages_crawled,
        created_at,
        updated_at,
        projects!inner(id, name, owner)
      `)
      .eq('projects.owner', userId)
      .order('created_at', { ascending: false })

    // Filter by project if specified
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data: crawls, error: crawlsError } = await query

    if (crawlsError) {
      console.error('Error fetching crawls:', crawlsError)
      return NextResponse.json(
        { error: 'Failed to fetch crawls' },
        { status: 500 }
      )
    }

    // Log successful access
    await supabase.rpc('log_cli_access', {
      p_user_id: userId,
      p_client_id: clientId,
      p_action: 'list_crawls',
      p_resource: 'crawls',
      p_resource_id: projectId || userId,
      p_endpoint: '/api/cli/crawls',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ CLI crawls listed: ${crawls.length} crawls for user ${userId}`)

    return NextResponse.json({
      success: true,
      crawls: crawls.map(crawl => ({
        id: crawl.id,
        rootUrl: crawl.root_url,
        scope: crawl.scope,
        maxDepth: crawl.max_depth,
        maxPages: crawl.max_pages,
        status: crawl.status,
        pagesCrawled: crawl.pages_crawled,
        projectId: crawl.projects.id,
        projectName: crawl.projects.name,
        createdAt: crawl.created_at,
        updatedAt: crawl.updated_at
      }))
    })

  } catch (error) {
    console.error('❌ CLI crawls fetch failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
