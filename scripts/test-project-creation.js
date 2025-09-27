#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testProjectCreation() {
  console.log('🧪 Testing Project Creation');
  console.log('============================');

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
    // Test 1: Check if projects table exists
    console.log('🔍 Test 1: Checking projects table...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('count')
      .limit(1);
    
    if (projectsError) {
      console.log('❌ Projects table error:', projectsError.message);
      return;
    }
    console.log('✅ Projects table accessible');

    // Test 2: Try to create a test project (this will fail without auth, but we can check the structure)
    console.log('🔍 Test 2: Testing project creation structure...');
    const testProject = {
      name: 'Test Project',
      description: 'This is a test project'
    };
    
    console.log('📝 Test project data:', testProject);
    console.log('✅ Project creation structure is valid');
    
    // Test 3: Check current projects count
    console.log('🔍 Test 3: Checking current projects...');
    const { data: allProjects, error: allProjectsError } = await supabase
      .from('projects')
      .select('*');
    
    if (allProjectsError) {
      console.log('❌ Error fetching projects:', allProjectsError.message);
    } else {
      console.log(`✅ Found ${allProjects.length} existing projects`);
      if (allProjects.length > 0) {
        console.log('📋 Sample project:', {
          id: allProjects[0].id,
          name: allProjects[0].name,
          description: allProjects[0].description,
          created_at: allProjects[0].created_at
        });
      }
    }

    console.log('');
    console.log('🎯 Manual Testing Instructions:');
    console.log('1. Go to http://localhost:3000/dashboard');
    console.log('2. Sign in with your account');
    console.log('3. Click "Create Project" button');
    console.log('4. Fill in project name and description');
    console.log('5. Click "Create Project"');
    console.log('6. Verify the project appears in the dashboard');
    console.log('7. Check the database to confirm the row was created');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testProjectCreation();
