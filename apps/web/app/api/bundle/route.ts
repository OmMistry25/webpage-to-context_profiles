import { createClientWithAuth } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { BundlerService } from '../../../lib/bundler'

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
    const { projectId } = body

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    console.log(`📦 Creating bundle for project: ${projectId}`)

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('owner', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Create bundle using the bundler service
    const bundlerService = new BundlerService()
    const result = await bundlerService.createBundle(projectId)

    return NextResponse.json({
      success: true,
      bundleId: result.bundleId,
      downloadUrl: result.downloadUrl,
      projectId,
      projectName: project.name
    })

  } catch (error) {
    console.error('❌ Bundle creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create bundle' },
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
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('owner', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Get latest bundle for the project
    const bundlerService = new BundlerService()
    const latestBundle = await bundlerService.getLatestBundle(projectId)

    if (!latestBundle) {
      return NextResponse.json({
        success: true,
        hasBundle: false,
        message: 'No bundles found for this project'
      })
    }

    return NextResponse.json({
      success: true,
      hasBundle: true,
      bundleId: latestBundle.bundleId,
      downloadUrl: latestBundle.downloadUrl,
      projectId,
      projectName: project.name
    })

  } catch (error) {
    console.error('❌ Failed to get latest bundle:', error)
    return NextResponse.json(
      { error: 'Failed to get latest bundle' },
      { status: 500 }
    )
  }
}
