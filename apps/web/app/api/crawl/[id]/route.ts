import { createClientWithAuth } from '../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the authenticated user using the request-aware client
    const supabase = createClientWithAuth(request)
    
    // Try to get user from the request (handles both cookie and header auth)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: crawlId } = await params

    // Validate crawl ID format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(crawlId)) {
      return NextResponse.json(
        { error: 'Invalid crawl ID format' },
        { status: 400 }
      )
    }

    // Fetch crawl details with project information
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .select(`
        *,
        projects!inner(
          id,
          name,
          description,
          owner
        )
      `)
      .eq('id', crawlId)
      .single()

    if (crawlError) {
      console.error('Error fetching crawl:', crawlError)
      if (crawlError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Crawl not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch crawl' },
        { status: 500 }
      )
    }

    // Verify the crawl belongs to the authenticated user
    if (crawl.projects.owner !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch related pages for this crawl
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .eq('crawl_id', crawlId)
      .order('created_at', { ascending: false })

    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
    }

    // Fetch chunk count for this crawl
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks')
      .select('id')
      .in('page_id', pages?.map(p => p.id) || [])

    if (chunksError) {
      console.error('Error fetching chunks:', chunksError)
    }

    // Calculate additional statistics
    const totalPages = pages?.length || 0
    const totalChunks = chunks?.length || 0
    const successfulPages = pages?.filter(p => p.status === 'success').length || 0
    const failedPages = pages?.filter(p => p.status === 'failed').length || 0

    // Return comprehensive crawl data
    return NextResponse.json({
      success: true,
      crawl: {
        id: crawl.id,
        project_id: crawl.project_id,
        project_name: crawl.projects.name,
        root_url: crawl.root_url,
        scope: crawl.scope,
        max_depth: crawl.max_depth,
        max_pages: crawl.max_pages,
        status: crawl.status,
        pages_crawled: crawl.pages_crawled,
        pages_failed: crawl.pages_failed,
        started_at: crawl.started_at,
        completed_at: crawl.completed_at,
        error_message: crawl.error_message,
        created_at: crawl.created_at,
        updated_at: crawl.updated_at,
        // Additional calculated fields
        total_pages: totalPages,
        successful_pages: successfulPages,
        failed_pages: failedPages,
        total_chunks: totalChunks,
        progress_percentage: crawl.max_pages > 0 ? Math.round((crawl.pages_crawled / crawl.max_pages) * 100) : 0
      },
      pages: pages || [],
      statistics: {
        total_pages: totalPages,
        successful_pages: successfulPages,
        failed_pages: failedPages,
        total_chunks: totalChunks,
        progress_percentage: crawl.max_pages > 0 ? Math.round((crawl.pages_crawled / crawl.max_pages) * 100) : 0
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
