#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testCrawlAPI() {
  console.log('🧪 Testing Crawl API Endpoint');
  console.log('==============================');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('❌ Supabase not configured. Please set environment variables:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Test 1: Check if we can access projects table
    console.log('🔍 Test 1: Checking projects table access...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*');
    
    if (projectsError) {
      console.log('❌ Projects table error:', projectsError.message);
      return;
    }
    console.log(`✅ Found ${projects.length} projects`);

    if (projects.length === 0) {
      console.log('⚠️  No projects found. Please create a project first.');
      return;
    }

    // Test 2: Check crawls table structure
    console.log('🔍 Test 2: Checking crawls table structure...');
    const { data: crawls, error: crawlsError } = await supabase
      .from('crawls')
      .select('*')
      .limit(1);
    
    if (crawlsError) {
      console.log('❌ Crawls table error:', crawlsError.message);
    } else {
      console.log('✅ Crawls table accessible');
    }

    // Test 3: Show sample project data
    const sampleProject = projects[0];
    console.log('🔍 Test 3: Sample project data:');
    console.log('📋 Project:', {
      id: sampleProject.id,
      name: sampleProject.name,
      description: sampleProject.description
    });

    console.log('');
    console.log('🎯 Manual Testing Instructions:');
    console.log('1. Go to http://localhost:3000/dashboard');
    console.log('2. Sign in with your account');
    console.log('3. Click "View" on a project');
    console.log('4. Click "Start New Crawl" button');
    console.log('5. Fill in the crawl form with:');
    console.log('   - URL: https://example.com');
    console.log('   - Scope: domain');
    console.log('   - Max Depth: 2');
    console.log('   - Max Pages: 50');
    console.log('6. Submit the form');
    console.log('7. Check that a new crawl appears in the Recent Crawls table');
    console.log('8. Verify the crawl has status "pending"');

    console.log('');
    console.log('🧪 API Testing with curl:');
    console.log('You can also test the API directly with curl:');
    console.log('');
    console.log('curl -X POST http://localhost:3000/api/crawl \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
    console.log('  -d \'{');
    console.log('    "project_id": "' + sampleProject.id + '",');
    console.log('    "root_url": "https://example.com",');
    console.log('    "scope": "domain",');
    console.log('    "max_depth": 2,');
    console.log('    "max_pages": 50');
    console.log('  }\'');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testCrawlAPI();
