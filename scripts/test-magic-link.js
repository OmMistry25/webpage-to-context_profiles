#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from apps/web/.env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

async function testMagicLink() {
  console.log('🔗 Testing Magic Link Configuration');
  console.log('===================================');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  console.log('✅ Created Supabase client');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log('');

  // Test sending a magic link
  const testEmail = process.argv[2];
  if (!testEmail) {
    console.log('❌ Please provide an email address to test with');
    console.log('Usage: npm run test:magic-link your-email@example.com');
    process.exit(1);
  }

  console.log(`🔄 Testing magic link for: ${testEmail}`);
  
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    });

    if (error) {
      console.log('❌ Error sending magic link:', error.message);
      console.log('');
      console.log('🔧 Possible fixes:');
      console.log('1. Check that Site URL is set to http://localhost:3000');
      console.log('2. Check that Redirect URLs includes http://localhost:3000/auth/callback');
      console.log('3. Check that Email OTP Expiry is set to at least 3600 seconds');
      console.log('4. Make sure Email authentication is enabled');
    } else {
      console.log('✅ Magic link sent successfully!');
      console.log('📧 Check your email for the magic link');
      console.log('⏰ Click the link immediately - it expires quickly!');
    }
  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
  }
}

testMagicLink().catch(console.error);
