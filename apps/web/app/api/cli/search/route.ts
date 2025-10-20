import { createClientWithAuth } from '../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface CLISearchRequest {
  query: string
  userId: string
  scope: 'projects' | 'crawls' | 'chunks' | 'all'
  filters?: {
    projectIds?: string[]
    dateRange?: { start: string; end: string }
    dataTypes?: string[]
  }
  limit?: number
  offset?: number
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

    const body: CLISearchRequest = await request.json()
    
    // Validate required fields
    if (!body.query || !body.userId || !body.scope) {
      return NextResponse.json(
        { error: 'Missing required fields: query, userId, and scope are required' },
        { status: 400 }
      )
    }

    // Check rate limiting
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', {
        p_client_id: clientId,
        p_user_id: body.userId,
        p_endpoint: '/api/cli/search'
      })

    if (rateLimitError || !rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Check if client has permission to search
    const { data: hasPermission, error: permissionError } = await supabase
      .rpc('check_cli_permission', {
        p_user_id: body.userId,
        p_client_id: clientId,
        p_required_scope: 'search:chunks'
      })

    if (permissionError || !hasPermission) {
      await supabase.rpc('log_cli_access', {
        p_user_id: body.userId,
        p_client_id: clientId,
        p_action: 'search_denied',
        p_resource: 'search',
        p_resource_id: body.query,
        p_endpoint: '/api/cli/search',
        p_ip_address: request.ip || '127.0.0.1',
        p_user_agent: request.headers.get('user-agent') || '',
        p_success: false,
        p_error_message: 'Insufficient permissions'
      })

      return NextResponse.json(
        { error: 'Insufficient permissions to search user data' },
        { status: 403 }
      )
    }

    const limit = Math.min(body.limit || 10, 100) // Max 100 results
    const offset = body.offset || 0

    let results: any[] = []

    // Search based on scope
    if (body.scope === 'projects' || body.scope === 'all') {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, description, created_at')
        .eq('owner', body.userId)
        .ilike('name', `%${body.query}%`)
        .limit(limit)
        .offset(offset)

      if (!projectsError && projects) {
        results.push(...projects.map(p => ({
          type: 'project',
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.created_at,
          relevance: 'name_match'
        })))
      }
    }

    if (body.scope === 'crawls' || body.scope === 'all') {
      let crawlsQuery = supabase
        .from('crawls')
        .select(`
          id, root_url, scope, max_depth, max_pages, status, created_at,
          projects!inner(id, name, owner)
        `)
        .eq('projects.owner', body.userId)
        .ilike('root_url', `%${body.query}%`)

      if (body.filters?.projectIds) {
        crawlsQuery = crawlsQuery.in('project_id', body.filters.projectIds)
      }

      if (body.filters?.dateRange) {
        crawlsQuery = crawlsQuery
          .gte('created_at', body.filters.dateRange.start)
          .lte('created_at', body.filters.dateRange.end)
      }

      const { data: crawls, error: crawlsError } = await crawlsQuery
        .limit(limit)
        .offset(offset)

      if (!crawlsError && crawls) {
        results.push(...crawls.map(c => ({
          type: 'crawl',
          id: c.id,
          url: c.root_url,
          scope: c.scope,
          maxDepth: c.max_depth,
          maxPages: c.max_pages,
          status: c.status,
          projectName: c.projects.name,
          createdAt: c.created_at,
          relevance: 'url_match'
        })))
      }
    }

    if (body.scope === 'chunks' || body.scope === 'all') {
      let chunksQuery = supabase
        .from('chunks')
        .select(`
          id, content, metadata, created_at,
          pages!inner(url, title, crawl_id, crawls!inner(project_id, projects!inner(owner)))
        `)
        .eq('pages.crawls.projects.owner', body.userId)
        .textSearch('content', body.query)

      if (body.filters?.projectIds) {
        chunksQuery = chunksQuery.in('pages.crawls.project_id', body.filters.projectIds)
      }

      if (body.filters?.dateRange) {
        chunksQuery = chunksQuery
          .gte('created_at', body.filters.dateRange.start)
          .lte('created_at', body.filters.dateRange.end)
      }

      const { data: chunks, error: chunksError } = await chunksQuery
        .limit(limit)
        .offset(offset)

      if (!chunksError && chunks) {
        results.push(...chunks.map(ch => ({
          type: 'chunk',
          id: ch.id,
          content: ch.content.substring(0, 500) + (ch.content.length > 500 ? '...' : ''),
          metadata: ch.metadata,
          pageUrl: ch.pages.url,
          pageTitle: ch.pages.title,
          crawlId: ch.pages.crawl_id,
          createdAt: ch.created_at,
          relevance: 'content_match'
        })))
      }
    }

    // Sort results by relevance and limit
    results = results
      .sort((a, b) => {
        const relevanceOrder = { 'name_match': 1, 'url_match': 2, 'content_match': 3 }
        return relevanceOrder[a.relevance] - relevanceOrder[b.relevance]
      })
      .slice(0, limit)

    // Log successful search
    await supabase.rpc('log_cli_access', {
      p_user_id: body.userId,
      p_client_id: clientId,
      p_action: 'search',
      p_resource: 'user_data',
      p_resource_id: body.query,
      p_endpoint: '/api/cli/search',
      p_ip_address: request.ip || '127.0.0.1',
      p_user_agent: request.headers.get('user-agent') || '',
      p_success: true
    })

    console.log(`✅ CLI search completed: "${body.query}" -> ${results.length} results`)

    return NextResponse.json({
      success: true,
      query: body.query,
      scope: body.scope,
      results: results,
      totalResults: results.length,
      limit: limit,
      offset: offset
    })

  } catch (error) {
    console.error('❌ CLI search failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
