import { withAPIKeyAuth, APIKeyValidationResult } from '../../../../../../lib/api-key-middleware'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

async function handleCrawlSearch(request: NextRequest, keyInfo: APIKeyValidationResult): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const crawlId = url.pathname.split('/')[4] // Extract crawl ID from path
    const searchParams = url.searchParams
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!crawlId) {
      return NextResponse.json(
        { error: 'Crawl ID is required' },
        { status: 400 }
      )
    }

    if (!query) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      )
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
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

    // Verify crawl ownership
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .select(`
        id,
        root_url,
        status,
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
        { error: 'Failed to fetch crawl' },
        { status: 500 }
      )
    }

    // Check if crawl is completed
    if (crawl.status !== 'completed') {
      return NextResponse.json(
        { error: 'Crawl is not completed yet. Current status: ' + crawl.status },
        { status: 400 }
      )
    }

    // Search through chunks using vector similarity
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_chunks', {
        query_text: query,
        match_threshold: 0.3,
        match_count: limit,
        crawl_id_filter: crawlId
      })

    if (searchError) {
      console.error('Search error:', searchError)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    // Get additional page information for the results
    const chunkIds = searchResults?.map((result: any) => result.id) || []
    
    let pagesData: any[] = []
    if (chunkIds.length > 0) {
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('id, url, title, chunks(id, content, metadata)')
        .in('id', searchResults?.map((result: any) => result.page_id) || [])
      
      if (!pagesError) {
        pagesData = pages || []
      }
    }

    // Combine search results with page data
    const enrichedResults = searchResults?.map((result: any) => {
      const page = pagesData.find(p => p.id === result.page_id)
      return {
        id: result.id,
        content: result.content,
        metadata: result.metadata,
        similarity_score: result.similarity,
        page: page ? {
          id: page.id,
          url: page.url,
          title: page.title
        } : null
      }
    }) || []

    return NextResponse.json({
      success: true,
      search: {
        query: query,
        crawl_id: crawlId,
        crawl_url: crawl.root_url,
        total_results: enrichedResults.length,
        results: enrichedResults.slice(offset, offset + limit)
      }
    })

  } catch (error) {
    console.error('Crawl search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withAPIKeyAuth(handleCrawlSearch)
