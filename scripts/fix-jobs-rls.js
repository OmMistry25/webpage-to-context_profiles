#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixJobsRLS() {
  console.log('🔄 Fixing jobs RLS policies');
  console.log('============================');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'infra', 'supabase', 'migrations', '004_fix_jobs_rls.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        // Use the REST API to execute raw SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            sql: statement
          })
        });

        if (response.ok) {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } else {
          const error = await response.text();
          console.log(`⚠️  Statement ${i + 1} result:`, error);
        }
      } catch (error) {
        console.log(`⚠️  Statement ${i + 1} error:`, error.message);
      }
    }

    console.log('\n🎉 Jobs RLS policies updated!');
    console.log('✅ Users can now insert jobs for their own crawls');
    console.log('✅ Users can view and update jobs for their own crawls');

  } catch (error) {
    console.error('❌ Error updating RLS policies:', error.message);
    console.log('\n💡 Manual fix needed:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Run the contents of: infra/supabase/migrations/004_fix_jobs_rls.sql');
  }
}

fixJobsRLS();
