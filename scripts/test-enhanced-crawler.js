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

async function testEnhancedCrawler() {
  console.log('🧪 Testing Enhanced Multi-Depth Crawler');
  console.log('=====================================');

  try {
    // Create a test project first (using service role, so we need to set owner manually)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([
        {
          name: 'Enhanced Crawler Test',
          description: 'Testing the new multi-depth crawler functionality',
          owner: '6640bd2d-51e9-40df-9074-3dc04037958e' // Real user ID
        }
      ])
      .select()
      .single();

    if (projectError) {
      console.error('❌ Error creating test project:', projectError);
      return;
    }

    console.log(`✅ Created test project: ${project.id}`);

    // Create a crawl with small limits for testing
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .insert([
        {
          project_id: project.id,
          root_url: 'https://example.com',
          scope: 'domain',
          max_depth: 2,
          max_pages: 5,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (crawlError) {
      console.error('❌ Error creating test crawl:', crawlError);
      return;
    }

    console.log(`✅ Created test crawl: ${crawl.id}`);
    console.log(`🌐 URL: ${crawl.root_url}`);
    console.log(`📊 Scope: ${crawl.scope}, Max Depth: ${crawl.max_depth}, Max Pages: ${crawl.max_pages}`);

    // Create a job for the worker to process
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([
        {
          type: 'crawl',
          status: 'pending',
          payload: { crawl_id: crawl.id }
        }
      ])
      .select()
      .single();

    if (jobError) {
      console.error('❌ Error creating job:', jobError);
      return;
    }

    console.log(`✅ Created job: ${job.id}`);
    console.log('');
    console.log('🚀 The enhanced crawler should now process this job!');
    console.log('📊 Watch the worker logs to see multi-depth crawling in action.');
    console.log('');
    console.log('🔍 You can monitor progress by running:');
    console.log('   node scripts/check-crawled-data.js');
    console.log('');
    console.log('⏰ This test crawl will:');
    console.log('   - Crawl https://example.com (depth 0)');
    console.log('   - Follow links to depth 1 and 2');
    console.log('   - Stop after 5 pages total');
    console.log('   - Extract content and convert to Markdown');
    console.log('   - Filter URLs by domain scope');

  } catch (error) {
    console.error('❌ Error in test:', error.message);
  }
}

testEnhancedCrawler();
