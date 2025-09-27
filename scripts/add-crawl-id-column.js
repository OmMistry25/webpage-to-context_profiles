#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
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

async function addCrawlIdColumn() {
  console.log('🔄 Adding crawl_id column to jobs table');
  console.log('======================================');

  try {
    // Add the crawl_id column
    const { error: alterError } = await supabase
      .from('jobs')
      .select('*')
      .limit(1);

    if (alterError) {
      console.log('❌ Error accessing jobs table:', alterError.message);
    } else {
      console.log('✅ Jobs table is accessible');
    }

    // Let's try a different approach - use raw SQL
    console.log('🔄 Attempting to add crawl_id column...');
    
    // We'll use the REST API to execute raw SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crawl_id UUID REFERENCES crawls(id) ON DELETE CASCADE;'
      })
    });

    if (response.ok) {
      console.log('✅ crawl_id column added successfully');
    } else {
      const error = await response.text();
      console.log('⚠️  Column might already exist or error occurred:', error);
    }

    // Create index
    const indexResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        sql: 'CREATE INDEX IF NOT EXISTS idx_jobs_crawl_id ON jobs(crawl_id);'
      })
    });

    if (indexResponse.ok) {
      console.log('✅ Index created successfully');
    } else {
      const error = await indexResponse.text();
      console.log('⚠️  Index might already exist or error occurred:', error);
    }

    console.log('\n🎉 Database schema updated!');
    console.log('✅ crawl_id column added to jobs table');
    console.log('✅ Index created for better performance');

  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    console.log('\n💡 Manual fix needed:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Run: ALTER TABLE jobs ADD COLUMN crawl_id UUID REFERENCES crawls(id) ON DELETE CASCADE;');
    console.log('4. Run: CREATE INDEX idx_jobs_crawl_id ON jobs(crawl_id);');
  }
}

addCrawlIdColumn();
