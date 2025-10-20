import { withAPIKeyAuth, APIKeyValidationResult } from '../../../../../../lib/api-key-middleware'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { BundlerService } from '../../../../../../lib/bundler'

async function handleCrawlExport(request: NextRequest, keyInfo: APIKeyValidationResult): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const crawlId = url.pathname.split('/')[4] // Extract crawl ID from path
    const searchParams = url.searchParams
    const format = searchParams.get('format') || 'zip'

    if (!crawlId) {
      return NextResponse.json(
        { error: 'Crawl ID is required' },
        { status: 400 }
      )
    }

    // Validate format
    const validFormats = ['zip', 'json', 'csv']
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be one of: zip, json, csv' },
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
        projects!inner(owner, id)
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

    // Create bundle using the bundler service
    const bundlerService = new BundlerService()
    const result = await bundlerService.createCrawlBundle(crawlId)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create export bundle' },
        { status: 500 }
      )
    }

    console.log(`✅ Public API export created: ${result.bundleId} for crawl ${crawlId}`)

    return NextResponse.json({
      success: true,
      export: {
        bundle_id: result.bundleId,
        download_url: result.downloadUrl,
        format: format,
        crawl_id: crawlId,
        crawl_url: crawl.root_url,
        created_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Crawl export API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withAPIKeyAuth(handleCrawlExport)
