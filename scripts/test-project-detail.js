#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testProjectDetail() {
  console.log('🧪 Testing Project Detail Page');
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

    // Test 3: Check pages table structure
    console.log('🔍 Test 3: Checking pages table structure...');
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .limit(1);
    
    if (pagesError) {
      console.log('❌ Pages table error:', pagesError.message);
    } else {
      console.log('✅ Pages table accessible');
    }

    // Test 4: Show sample project data
    const sampleProject = projects[0];
    console.log('🔍 Test 4: Sample project data:');
    console.log('📋 Project:', {
      id: sampleProject.id,
      name: sampleProject.name,
      description: sampleProject.description,
      created_at: sampleProject.created_at
    });

    console.log('');
    console.log('🎯 Manual Testing Instructions:');
    console.log('1. Go to http://localhost:3000/dashboard');
    console.log('2. Sign in with your account');
    console.log('3. Click "View" button on your project card');
    console.log('4. You should see the project detail page with:');
    console.log('   - Project name and description');
    console.log('   - Quick Actions section (Start New Crawl, Export Data, Settings)');
    console.log('   - Crawl Statistics (Total Crawls, Completed, Running, Pages Crawled)');
    console.log('   - Recent Crawls table (empty if no crawls yet)');
    console.log('5. The page should show "No crawls yet" with a "Start First Crawl" button');
    console.log('6. Test the "Back to Dashboard" button');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testProjectDetail();
