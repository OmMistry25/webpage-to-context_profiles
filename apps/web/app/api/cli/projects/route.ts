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
        p_endpoint: '/api/cli/projects'
      })

    if (rateLimitError || !rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Check if client has permission to read projects
    const { data: hasPermission, error: permissionError } = await supabase
      .rpc('check_cli_permission', {
        p_user_id: userId,
        p_client_id: clientId,
        p_required_scope: 'read:projects'
      })

    if (permissionError || !hasPermission) {
      await supabase.rpc('log_cli_access', {
        p_user_id: userId,
        p_client_id: clientId,
        p_action: 'list_projects_denied',
        p_resource: 'projects',
        p_resource_id: userId,
        p_endpoint: '/api/cli/projects',
        p_ip_address: request.ip || '127.0.0.1',
        p_user_agent: request.headers.get('user-agent') || '',
        p_success: false,
        p_error_message: 'Insufficient permissions'
      })

      return NextResponse.json(
        { error: 'Insufficient permissions to read projects' },
        { status: 403 }
      )
    }

    // Fetch user's projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        crawls(id, status, pages_crawled, created_at)
      `)
      .eq('owner', userId)
      .order('created_at', { ascending: false })

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      )
    }

    // Log successful access
    await supabase.rpc('log_cli_access', {
      p_user_id: userId,
      p_client_id: clientId,
      p_action: 'list_projects',
      p_resource: 'projects',
      p_resource_id: userId,
      p_endpoint: '/api/cli/projects',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ CLI projects listed: ${projects.length} projects for user ${userId}`)

    return NextResponse.json({
      success: true,
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        totalCrawls: project.crawls.length,
        completedCrawls: project.crawls.filter((c: any) => c.status === 'completed').length,
        totalPages: project.crawls.reduce((sum: number, c: any) => sum + (c.pages_crawled || 0), 0)
      }))
    })

  } catch (error) {
    console.error('❌ CLI projects fetch failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
