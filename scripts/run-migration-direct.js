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

async function runMigration() {
  try {
    console.log('🚀 Running CLI permissions migration...')
    
    // Test connection first
    console.log('🔍 Testing connection...')
    const { data: testData, error: testError } = await supabase.from('projects').select('count').limit(1)
    
    if (testError) {
      console.error('❌ Connection test failed:', testError)
      return false
    }
    
    console.log('✅ Connection successful')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../infra/supabase/migrations/006_add_cli_permissions.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded')
    
    // Split into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        
        try {
          // Use the raw SQL execution method
          const { data, error } = await supabase.rpc('exec', {
            sql: statement + ';'
          })
          
          if (error) {
            console.error(`❌ Statement ${i + 1} failed:`, error.message)
            errorCount++
          } else {
            console.log(`✅ Statement ${i + 1} completed`)
            successCount++
          }
        } catch (err) {
          console.error(`❌ Statement ${i + 1} error:`, err.message)
          errorCount++
        }
      }
    }
    
    console.log(`\n📊 Migration Summary:`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${errorCount}`)
    
    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!')
      return true
    } else {
      console.log('⚠️  Migration completed with some errors')
      return false
    }
    
  } catch (error) {
    console.error('❌ Migration execution failed:', error)
    return false
  }
}

async function main() {
  const success = await runMigration()
  if (success) {
    console.log('\n✅ CLI system is ready!')
    console.log('📊 You can now test the CLI functionality with real data')
  } else {
    console.log('\n❌ Migration had issues')
    console.log('💡 You may need to run some statements manually in the Supabase dashboard')
  }
}

main().catch(console.error)
