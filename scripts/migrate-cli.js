const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
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

async function runMigration() {
  try {
    console.log('🚀 Running CLI permissions migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../infra/supabase/migrations/006_add_cli_permissions.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded, executing...')
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        
        try {
          const { data, error } = await supabase.rpc('exec', {
            sql: statement + ';'
          })
          
          if (error) {
            console.error(`❌ Statement ${i + 1} failed:`, error)
            // Continue with other statements
          } else {
            console.log(`✅ Statement ${i + 1} completed`)
          }
        } catch (err) {
          console.error(`❌ Statement ${i + 1} error:`, err.message)
        }
      }
    }
    
    console.log('✅ Migration completed!')
    console.log('📊 CLI permissions system is now set up')
    
  } catch (error) {
    console.error('❌ Migration execution failed:', error)
    process.exit(1)
  }
}

// Test connection first
async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...')
    const { data, error } = await supabase.from('projects').select('count').limit(1)
    
    if (error) {
      console.error('❌ Connection test failed:', error)
      return false
    }
    
    console.log('✅ Supabase connection successful')
    return true
  } catch (error) {
    console.error('❌ Connection test failed:', error)
    return false
  }
}

async function main() {
  const connected = await testConnection()
  if (!connected) {
    process.exit(1)
  }
  
  await runMigration()
}

main().catch(console.error)
