import { createClientWithAuth } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface CrawlRequest {
  project_id: string
  root_url: string
  scope?: string
  max_depth?: number
  max_pages?: number
}

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body: CrawlRequest = await request.json()
    
    // Validate required fields
    if (!body.project_id || !body.root_url) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id and root_url are required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(body.root_url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Set defaults for optional fields
    const scope = body.scope || 'domain'
    const max_depth = body.max_depth || 3
    const max_pages = body.max_pages || 100

    // Validate scope
    if (!['domain', 'subdomain', 'path'].includes(scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be one of: domain, subdomain, path' },
        { status: 400 }
      )
    }

    // Validate numeric values
    if (max_depth < 1 || max_depth > 10) {
      return NextResponse.json(
        { error: 'max_depth must be between 1 and 10' },
        { status: 400 }
      )
    }

    if (max_pages < 1 || max_pages > 10000) {
      return NextResponse.json(
        { error: 'max_pages must be between 1 and 10000' },
        { status: 400 }
      )
    }

    // Verify the project belongs to the user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', body.project_id)
      .eq('owner', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Create the crawl record
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .insert([
        {
          project_id: body.project_id,
          root_url: body.root_url,
          scope: scope,
          max_depth: max_depth,
          max_pages: max_pages,
          status: 'pending'
        }
      ])
      .select()
      .single()

    if (crawlError) {
      console.error('Error creating crawl:', crawlError)
      return NextResponse.json(
        { error: 'Failed to create crawl' },
        { status: 500 }
      )
    }

    // Create a job for the worker to process
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([
        {
          type: 'crawl',
          status: 'pending',
          payload: { crawl_id: crawl.id }
        }
      ])
      .select()
      .single()

    if (jobError) {
      console.error('Error creating job:', jobError)
      // Don't fail the crawl creation if job creation fails
      console.warn('Crawl created but job creation failed - worker may not process this crawl')
    } else {
      console.log(`✅ Created job ${job.id} for crawl ${crawl.id}`)
    }

    // Return the crawl ID and details
    return NextResponse.json({
      success: true,
      crawl_id: crawl.id,
      crawl: {
        id: crawl.id,
        project_id: crawl.project_id,
        root_url: crawl.root_url,
        scope: crawl.scope,
        max_depth: crawl.max_depth,
        max_pages: crawl.max_pages,
        status: crawl.status,
        created_at: crawl.created_at
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
