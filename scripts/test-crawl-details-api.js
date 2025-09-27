#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testCrawlDetailsAPI() {
  console.log('🧪 Testing Crawl Details API Endpoint');
  console.log('=====================================');

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
    // Test 1: Check if we can access crawls table
    console.log('🔍 Test 1: Checking crawls table access...');
    const { data: crawls, error: crawlsError } = await supabase
      .from('crawls')
      .select('*')
      .limit(1);
    
    if (crawlsError) {
      console.log('❌ Crawls table error:', crawlsError.message);
      return;
    }
    console.log(`✅ Found ${crawls.length} crawls`);

    if (crawls.length === 0) {
      console.log('⚠️  No crawls found. Please create a crawl first.');
      return;
    }

    // Test 2: Check pages table structure
    console.log('🔍 Test 2: Checking pages table structure...');
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .limit(1);
    
    if (pagesError) {
      console.log('❌ Pages table error:', pagesError.message);
    } else {
      console.log('✅ Pages table accessible');
    }

    // Test 3: Show sample crawl data
    const sampleCrawl = crawls[0];
    console.log('🔍 Test 3: Sample crawl data:');
    console.log('📋 Crawl:', {
      id: sampleCrawl.id,
      project_id: sampleCrawl.project_id,
      root_url: sampleCrawl.root_url,
      status: sampleCrawl.status,
      pages_crawled: sampleCrawl.pages_crawled,
      pages_failed: sampleCrawl.pages_failed
    });

    console.log('');
    console.log('🎯 Manual Testing Instructions:');
    console.log('1. Go to http://localhost:3000/dashboard');
    console.log('2. Sign in with your account');
    console.log('3. Click "View" on a project');
    console.log('4. Click "View" on a crawl in the Recent Crawls table');
    console.log('5. This should navigate to a crawl detail page');
    console.log('6. The page should show:');
    console.log('   - Crawl information (URL, status, progress)');
    console.log('   - Pages that were crawled');
    console.log('   - Statistics and progress');

    console.log('');
    console.log('🧪 API Testing with curl:');
    console.log('You can also test the API directly with curl:');
    console.log('');
    console.log('curl -X GET http://localhost:3000/api/crawl/' + sampleCrawl.id + ' \\');
    console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN"');

    console.log('');
    console.log('✅ Expected API Response:');
    console.log('- success: true');
    console.log('- crawl: { id, project_id, root_url, status, pages_crawled, etc. }');
    console.log('- pages: [array of crawled pages]');
    console.log('- statistics: { total_pages, successful_pages, failed_pages, total_chunks, progress_percentage }');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testCrawlDetailsAPI();
