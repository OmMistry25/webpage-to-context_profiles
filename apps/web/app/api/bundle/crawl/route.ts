import { createClientWithAuth } from '../../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { BundlerService } from '../../../../lib/bundler'

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

    const body = await request.json()
    const { crawlId } = body

    if (!crawlId || typeof crawlId !== 'string') {
      return NextResponse.json(
        { error: 'Crawl ID is required' },
        { status: 400 }
      )
    }

    console.log(`📦 Creating bundle for crawl: ${crawlId}`)

    // Verify user has access to this crawl
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .select(`
        *,
        projects!inner(id, name, owner)
      `)
      .eq('id', crawlId)
      .eq('projects.owner', user.id)
      .single()

    if (crawlError || !crawl) {
      return NextResponse.json(
        { error: 'Crawl not found or access denied' },
        { status: 404 }
      )
    }

    // Create bundle using the bundler service
    const bundlerService = new BundlerService()
    const result = await bundlerService.createCrawlBundle(crawlId)

    return NextResponse.json({
      success: true,
      bundleId: result.bundleId,
      downloadUrl: result.downloadUrl,
      crawlId,
      crawlUrl: crawl.root_url,
      projectName: crawl.projects.name
    })

  } catch (error) {
    console.error('❌ Crawl bundle creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create crawl bundle' },
      { status: 500 }
    )
  }
}
