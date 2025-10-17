const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
const envPath = path.join(__dirname, '../apps/web/.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function createCLITables() {
  try {
    console.log('🚀 Creating CLI tables manually...')
    
    // Test connection first
    console.log('🔍 Testing connection...')
    const { data: testData, error: testError } = await supabase.from('projects').select('count').limit(1)
    
    if (testError) {
      console.error('❌ Connection test failed:', testError)
      return false
    }
    
    console.log('✅ Connection successful')
    
    // Since we can't execute raw SQL, let's create a simple test client record
    // This will help us test the CLI functionality
    
    console.log('📝 Creating test CLI client...')
    
    // Generate test client credentials
    const clientId = 'test-cli-client-' + Date.now()
    const clientSecret = 'test-secret-' + Math.random().toString(36).substring(7)
    
    // Try to insert a test record (this will fail if table doesn't exist, which is expected)
    try {
      const { data, error } = await supabase
        .from('cli_clients')
        .insert([
          {
            name: 'Test CLI Client',
            description: 'Test client for CLI API',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: 'http://localhost:8080/callback',
            scopes: ['read:projects', 'read:crawls', 'search:chunks', 'export:data'],
            created_by: '00000000-0000-0000-0000-000000000000' // Dummy UUID
          }
        ])
        .select()
        .single()
      
      if (error) {
        console.log('❌ CLI clients table does not exist yet:', error.message)
        console.log('💡 This is expected - we need to create the tables first')
        return false
      } else {
        console.log('✅ Test CLI client created:', data.name)
        return true
      }
    } catch (err) {
      console.log('❌ CLI clients table does not exist:', err.message)
      return false
    }
    
  } catch (error) {
    console.error('❌ Table creation failed:', error)
    return false
  }
}

async function checkExistingTables() {
  try {
    console.log('🔍 Checking existing tables...')
    
    // Check if CLI tables exist by trying to query them
    const tables = ['cli_clients', 'user_cli_permissions', 'cli_audit_logs', 'cli_rate_limits']
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('count').limit(1)
        if (error) {
          console.log(`❌ Table ${table} does not exist`)
        } else {
          console.log(`✅ Table ${table} exists`)
        }
      } catch (err) {
        console.log(`❌ Table ${table} does not exist`)
      }
    }
  } catch (error) {
    console.error('❌ Table check failed:', error)
  }
}

async function main() {
  console.log('🔍 Checking existing CLI tables...')
  await checkExistingTables()
  
  console.log('\n📝 Attempting to create test CLI client...')
  const success = await createCLITables()
  
  if (!success) {
    console.log('\n💡 To create the CLI tables, you need to:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the contents of infra/supabase/migrations/006_add_cli_permissions.sql')
    console.log('4. Execute the SQL')
    console.log('\n📄 Migration file location: infra/supabase/migrations/006_add_cli_permissions.sql')
  } else {
    console.log('\n✅ CLI tables are ready!')
  }
}

main().catch(console.error)
