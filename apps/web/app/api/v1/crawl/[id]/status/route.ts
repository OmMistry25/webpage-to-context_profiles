import { withAPIKeyAuth, APIKeyValidationResult } from '../../../../../../lib/api-key-middleware'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

async function handleCrawlStatus(request: NextRequest, keyInfo: APIKeyValidationResult): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const crawlId = url.pathname.split('/')[4] // Extract crawl ID from path

    if (!crawlId) {
      return NextResponse.json(
        { error: 'Crawl ID is required' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get crawl details with project ownership check
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .select(`
        id,
        root_url,
        scope,
        max_depth,
        max_pages,
        status,
        created_at,
        completed_at,
        error_message,
        projects!inner(owner)
      `)
      .eq('id', crawlId)
      .eq('projects.owner', keyInfo.createdBy)
      .single()

    if (crawlError) {
      if (crawlError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Crawl not found or access denied' },
          { status: 404 }
        )
      }
      console.error('Error fetching crawl:', crawlError)
      return NextResponse.json(
        { error: 'Failed to fetch crawl status' },
        { status: 500 }
      )
    }

    // Get crawl statistics
    const { data: stats, error: statsError } = await supabase
      .from('pages')
      .select('id, status')
      .eq('crawl_id', crawlId)

    if (statsError) {
      console.error('Error fetching crawl stats:', statsError)
    }

    const totalPages = stats?.length || 0
    const completedPages = stats?.filter(p => p.status === 'completed').length || 0
    const failedPages = stats?.filter(p => p.status === 'failed').length || 0

    return NextResponse.json({
      success: true,
      crawl: {
        id: crawl.id,
        url: crawl.root_url,
        scope: crawl.scope,
        max_depth: crawl.max_depth,
        max_pages: crawl.max_pages,
        status: crawl.status,
        created_at: crawl.created_at,
        completed_at: crawl.completed_at,
        error_message: crawl.error_message,
        statistics: {
          total_pages: totalPages,
          completed_pages: completedPages,
          failed_pages: failedPages,
          progress_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0
        }
      }
    })

  } catch (error) {
    console.error('Crawl status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withAPIKeyAuth(handleCrawlStatus)
