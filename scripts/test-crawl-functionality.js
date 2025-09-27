#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testCrawlFunctionality() {
  console.log('🧪 Testing Complete Crawl Functionality');
  console.log('=======================================');

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
    console.log('5. A modal should appear with crawl form fields:');
    console.log('   - Website URL (required)');
    console.log('   - Crawl Scope (domain/subdomain/path)');
    console.log('   - Max Depth (1-10)');
    console.log('   - Max Pages (1-10000)');
    console.log('6. Fill in the form with:');
    console.log('   - URL: https://example.com');
    console.log('   - Scope: domain');
    console.log('   - Max Depth: 2');
    console.log('   - Max Pages: 50');
    console.log('7. Click "Start Crawl"');
    console.log('8. The modal should close and a new crawl should appear in the Recent Crawls table');
    console.log('9. The crawl should have status "pending"');

    console.log('');
    console.log('✅ Expected Behavior:');
    console.log('- Modal opens when clicking "Start New Crawl"');
    console.log('- Form validation works (URL required)');
    console.log('- API call succeeds and creates crawl record');
    console.log('- Modal closes after successful submission');
    console.log('- New crawl appears in the table with "pending" status');
    console.log('- Page refreshes to show updated crawl list');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testCrawlFunctionality();
