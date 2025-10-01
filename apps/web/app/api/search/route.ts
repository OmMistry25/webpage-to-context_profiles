import { createClientWithAuth } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { HybridSearchService } from '../../../lib/search'

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
    const { query, projectId, limit = 10, semanticWeight = 0.7, keywordWeight = 0.3 } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    // Perform hybrid search
    const searchService = new HybridSearchService(semanticWeight, keywordWeight)
    const results = await searchService.searchWithFallback(query, {
      limit,
      semanticWeight,
      keywordWeight,
      projectId
    })

    return NextResponse.json({
      query,
      results,
      total: results.length,
      searchOptions: {
        limit,
        semanticWeight,
        keywordWeight,
        projectId
      }
    })

  } catch (error) {
    console.error('❌ Search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClientWithAuth(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const projectId = searchParams.get('projectId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const semanticWeight = parseFloat(searchParams.get('semanticWeight') || '0.7')
    const keywordWeight = parseFloat(searchParams.get('keywordWeight') || '0.3')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    // Perform hybrid search
    const searchService = new HybridSearchService(semanticWeight, keywordWeight)
    const results = await searchService.searchWithFallback(query, {
      limit,
      semanticWeight,
      keywordWeight,
      projectId: projectId || undefined
    })

    return NextResponse.json({
      query,
      results,
      total: results.length,
      searchOptions: {
        limit,
        semanticWeight,
        keywordWeight,
        projectId
      }
    })

  } catch (error) {
    console.error('❌ Search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
