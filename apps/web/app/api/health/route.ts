import { createClient } from '../../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({
        status: 'ok',
        message: 'Health check passed - Supabase not configured yet',
        timestamp: new Date().toISOString(),
        database: 'not_configured'
      })
    }

    const supabase = createClient()
    
    // Test database connection
    const { data, error } = await supabase
      .from('projects')
      .select('count')
      .limit(1)
    
    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Database connection failed', error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Health check passed',
      timestamp: new Date().toISOString(),
      database: 'connected'
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Health check failed', error: String(error) },
      { status: 500 }
    )
  }
}
