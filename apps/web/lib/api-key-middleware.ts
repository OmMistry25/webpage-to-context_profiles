import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

interface APIKeyValidationResult {
  isValid: boolean
  keyId?: string
  keyName?: string
  createdBy?: string
  isActive?: boolean
  expiresAt?: string
}

export async function validateAPIKey(apiKey: string): Promise<APIKeyValidationResult> {
  try {
    console.log('🔍 Validating API key:', apiKey.substring(0, 8) + '...')
    
    if (!apiKey) {
      console.log('❌ No API key provided')
      return { isValid: false }
    }

    // Create Supabase client with service role key for validation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables')
      return { isValid: false }
    }

    console.log('✅ Environment variables found')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Hash the API key to compare with stored hash
    // Use the same method as the database function: encode(digest(key_value, 'sha256'), 'hex')
    const crypto = require('crypto')
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
    console.log('🔐 Generated hash:', keyHash.substring(0, 16) + '...')

    // Query the api_keys table directly instead of using the function
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_name, created_by, is_active, expires_at, key_hash')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.log('❌ API key not found or inactive:', error?.message || 'No data')
      return { isValid: false }
    }

    console.log('✅ API key found in database:', data.key_name)

    // Check if key is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.log('❌ API key expired')
      return { isValid: false }
    }

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)

    console.log('✅ API key validation successful')
    return {
      isValid: true,
      keyId: data.id,
      keyName: data.key_name,
      createdBy: data.created_by,
      isActive: data.is_active,
      expiresAt: data.expires_at
    }

  } catch (error) {
    console.error('❌ API key validation failed:', error)
    return { isValid: false }
  }
}

export async function logAPIUsage(
  keyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables for logging')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    await supabase.rpc('log_api_usage', {
      p_api_key_id: keyId,
      p_endpoint: endpoint,
      p_method: method,
      p_status_code: statusCode,
      p_response_time_ms: responseTimeMs,
      p_ip_address: ipAddress,
      p_user_agent: userAgent
    })

  } catch (error) {
    console.error('Failed to log API usage:', error)
    // Don't throw error - logging failure shouldn't break the API
  }
}

export function withAPIKeyAuth(handler: (request: NextRequest, keyInfo: APIKeyValidationResult) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    
    try {
      // Extract API key from Authorization header
      const authHeader = request.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'API key required. Use Authorization: Bearer <your-api-key>' },
          { status: 401 }
        )
      }

      const apiKey = authHeader.replace('Bearer ', '')
      
      // Validate API key
      const keyInfo = await validateAPIKey(apiKey)
      
      if (!keyInfo.isValid) {
        return NextResponse.json(
          { error: 'Invalid or expired API key' },
          { status: 401 }
        )
      }

      // Call the actual handler with key info
      const response = await handler(request, keyInfo)
      
      // Log API usage
      const responseTime = Date.now() - startTime
      const url = new URL(request.url)
      const endpoint = url.pathname
      const method = request.method
      const statusCode = response.status
      const ipAddress = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1'
      const userAgent = request.headers.get('user-agent') || ''

      await logAPIUsage(
        keyInfo.keyId!,
        endpoint,
        method,
        statusCode,
        responseTime,
        ipAddress,
        userAgent
      )

      return response

    } catch (error) {
      console.error('API key middleware error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
