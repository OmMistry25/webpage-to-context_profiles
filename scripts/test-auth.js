#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testAuth() {
  console.log('🔐 Testing Supabase Authentication');
  console.log('==================================');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  console.log('✅ Created Supabase client');
  console.log('');

  // Test 1: Check if auth is enabled
  console.log('🔄 Test 1: Checking auth configuration');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && error.message.includes('Auth not enabled')) {
      console.log('❌ Auth is not enabled in your Supabase project');
      console.log('   Please enable Auth in your Supabase dashboard:');
      console.log('   1. Go to Authentication > Settings');
      console.log('   2. Enable Email authentication');
      console.log('   3. Configure Site URL (http://localhost:3000 for dev)');
      process.exit(1);
    } else {
      console.log('✅ Auth is enabled and configured');
    }
  } catch (err) {
    console.log('❌ Error checking auth:', err.message);
    process.exit(1);
  }
  console.log('');

  // Test 2: Check current session
  console.log('🔄 Test 2: Checking current session');
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.log('❌ Error getting session:', error.message);
    } else if (session) {
      console.log('✅ User is signed in:', session.user.email);
    } else {
      console.log('ℹ️  No active session (user not signed in)');
    }
  } catch (err) {
    console.log('❌ Error checking session:', err.message);
  }
  console.log('');

  // Test 3: Test email/password authentication
  console.log('🔄 Test 3: Testing email/password authentication');
  console.log('ℹ️  To test email/password auth:');
  console.log('   1. Start the dev server: npm run dev');
  console.log('   2. Go to http://localhost:3000/auth/login');
  console.log('   3. Click "Need an account? Sign Up"');
  console.log('   4. Enter your email and password');
  console.log('   5. Click "Create Account"');
  console.log('   6. You should be redirected to dashboard immediately');
  console.log('   7. Sign out and sign in again to test login flow');
  console.log('');

  console.log('🎉 Auth testing completed!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Make sure Auth is enabled in Supabase dashboard');
  console.log('2. Enable Email provider in Authentication > Providers');
  console.log('3. Test the email/password flow in the browser');
  console.log('');
  console.log('🔗 Useful URLs:');
  console.log('- Home: http://localhost:3000');
  console.log('- Login: http://localhost:3000/auth/login');
  console.log('- Dashboard: http://localhost:3000/dashboard');
}

testAuth().catch(console.error);
