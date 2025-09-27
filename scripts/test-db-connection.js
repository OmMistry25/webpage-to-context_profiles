#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection');
  console.log('==============================');
  
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase not configured. Please set environment variables:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL');
    console.log('   SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    console.log('');
    console.log('You can set these in your .env.local file or as environment variables.');
    process.exit(1);
  }

  console.log(`✅ Supabase URL: ${supabaseUrl}`);
  console.log(`✅ Supabase Key: ${supabaseKey.substring(0, 20)}...`);
  console.log('');

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test basic connection
  console.log('🔄 Testing basic connection...');
  try {
    const { data, error } = await supabase.from('projects').select('count').limit(1);
    
    if (error) {
      console.log('❌ Database connection failed:', error.message);
      console.log('');
      console.log('This might mean:');
      console.log('1. The database tables don\'t exist yet (run migrations first)');
      console.log('2. The connection credentials are incorrect');
      console.log('3. The database is not accessible');
      process.exit(1);
    }
    
    console.log('✅ Database connection successful!');
    console.log('');
    
    // Test if tables exist
    console.log('🔄 Checking if tables exist...');
    const tables = ['projects', 'crawls', 'pages', 'chunks', 'jobs', 'bundles'];
    
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error) {
          console.log(`❌ Table '${table}' does not exist`);
        } else {
          console.log(`✅ Table '${table}' exists`);
        }
      } catch (err) {
        console.log(`❌ Error checking table '${table}':`, err.message);
      }
    }
    
    console.log('');
    console.log('🎉 Database is ready!');
    
  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

testDatabaseConnection().catch(console.error);
