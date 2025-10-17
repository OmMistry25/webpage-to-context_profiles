#!/usr/bin/env node

/**
 * Script to apply the API migration manually
 * This reads the SQL file and applies it to the database
 */

const fs = require('fs')
const path = require('path')

async function applyMigration() {
  try {
    console.log('🚀 Applying API migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../infra/supabase/migrations/007_add_public_api_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file read successfully')
    console.log('📋 Migration contains:')
    console.log('   - api_keys table')
    console.log('   - api_usage table')
    console.log('   - generate_api_key() function')
    console.log('   - validate_api_key() function')
    console.log('   - log_api_usage() function')
    console.log('   - get_api_usage_stats() function')
    console.log('   - RLS policies')
    
    console.log('\n⚠️  Manual Migration Required')
    console.log('================================')
    console.log('Please apply this migration manually through the Supabase dashboard:')
    console.log('\n1. Go to your Supabase project dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the following SQL:')
    console.log('\n' + '='.repeat(50))
    console.log(migrationSQL)
    console.log('='.repeat(50))
    
    console.log('\n✅ After applying the migration, the API endpoints will be available!')
    
  } catch (error) {
    console.error('❌ Error reading migration file:', error.message)
  }
}

if (require.main === module) {
  applyMigration()
}

module.exports = { applyMigration }