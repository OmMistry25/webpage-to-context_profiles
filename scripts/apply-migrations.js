#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function printMigrationInstructions() {
  console.log('📋 Database Migration Instructions');
  console.log('=====================================');
  console.log('');
  console.log('To apply the database migrations, you have several options:');
  console.log('');
  console.log('Option 1: Using Supabase CLI (Recommended)');
  console.log('1. Install Supabase CLI: npm install -g supabase');
  console.log('2. Login: supabase login');
  console.log('3. Link your project: supabase link --project-ref YOUR_PROJECT_REF');
  console.log('4. Apply migrations: supabase db push');
  console.log('');
  console.log('Option 2: Using Supabase Dashboard');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the contents of: infra/supabase/migrations/001_initial_schema.sql');
  console.log('4. Run the SQL');
  console.log('');
  console.log('Option 3: Using psql (if you have direct database access)');
  console.log('1. Connect to your database with psql');
  console.log('2. Run: \\i infra/supabase/migrations/001_initial_schema.sql');
  console.log('');
  console.log('📁 Migration files found:');
  
  const migrationsDir = path.join(__dirname, '..', 'infra', 'supabase', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    migrationFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
  } else {
    console.log('   No migrations directory found');
  }
  
  console.log('');
  console.log('After applying migrations, run: npm run test:db');
}

printMigrationInstructions();
