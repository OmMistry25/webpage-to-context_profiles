import { withAPIKeyAuth, APIKeyValidationResult } from '../../../../lib/api-key-middleware'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

interface PublicCrawlRequest {
  url: string
  max_depth?: number
  max_pages?: number
  scope?: string
}

async function handleCrawlRequest(request: NextRequest, keyInfo: APIKeyValidationResult): Promise<NextResponse> {
  try {
    console.log('🚀 Public crawl API called with key info:', keyInfo)
    const body: PublicCrawlRequest = await request.json()
    
    // Validate required fields
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(body.url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Set defaults for optional fields
    const max_depth = Math.min(body.max_depth || 3, 5) // Limit to 5 for public API
    const max_pages = Math.min(body.max_pages || 50, 200) // Limit to 200 for public API
    const scope = body.scope || 'domain'

    // Validate scope
    if (!['domain', 'subdomain', 'path'].includes(scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be one of: domain, subdomain, path' },
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

    // Create a project for this API key if it doesn't exist
    const { data: existingProject, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('owner', keyInfo.createdBy)
      .eq('name', `API Project - ${keyInfo.keyName}`)
      .single()

    let projectId: string

    if (projectError && projectError.code === 'PGRST116') {
      // Project doesn't exist, create it
      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert([
          {
            name: `API Project - ${keyInfo.keyName}`,
            description: `Auto-created project for API key: ${keyInfo.keyName}`,
            owner: keyInfo.createdBy
          }
        ])
        .select()
        .single()

      if (createError) {
        console.error('Error creating project:', createError)
        return NextResponse.json(
          { error: 'Failed to create project' },
          { status: 500 }
        )
      }

      projectId = newProject.id
    } else if (projectError) {
      console.error('Error checking project:', projectError)
      return NextResponse.json(
        { error: 'Failed to check project' },
        { status: 500 }
      )
    } else {
      projectId = existingProject.id
    }

    // Create the crawl record
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .insert([
        {
          project_id: projectId,
          root_url: body.url,
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
    }

    console.log(`✅ Public API crawl created: ${crawl.id} for ${body.url}`)

    return NextResponse.json({
      success: true,
      crawl: {
        id: crawl.id,
        url: crawl.root_url,
        scope: crawl.scope,
        max_depth: crawl.max_depth,
        max_pages: crawl.max_pages,
        status: crawl.status,
        created_at: crawl.created_at
      }
    })

  } catch (error) {
    console.error('Public crawl API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withAPIKeyAuth(handleCrawlRequest)
