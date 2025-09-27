import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase environment variables are not set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testEnhancedCrawlerWithStorage() {
  console.log('🧪 Testing Enhanced Crawler with Storage Upload');
  console.log('===============================================');

  try {
    // Get an existing user ID for the project owner
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError || !users || users.users.length === 0) {
      console.error('❌ Error fetching existing user:', userError);
      console.error('Please ensure you have at least one user registered in Supabase.');
      return;
    }
    const existingUserId = users.users[0].id;

    // Create a test project first
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([
        {
          name: 'Enhanced Crawler Storage Test',
          description: 'Testing the enhanced crawler with storage upload functionality',
          owner: existingUserId
        }
      ])
      .select()
      .single();

    if (projectError) {
      console.error('❌ Error creating test project:', projectError);
      return;
    }
    console.log(`✅ Created test project: ${project.id}`);

    // Create a test crawl with a simple website
    const rootUrl = 'https://example.com'; // Simple site for testing
    const maxDepth = 2;
    const maxPages = 3;
    const scope = 'domain';

    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .insert([
        {
          project_id: project.id,
          root_url: rootUrl,
          scope: scope,
          max_depth: maxDepth,
          max_pages: maxPages,
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
    console.log(`🌐 URL: ${rootUrl}`);
    console.log(`📊 Scope: ${scope}, Max Depth: ${maxDepth}, Max Pages: ${maxPages}`);

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

    console.log('\n🚀 The enhanced crawler should now process this job!');
    console.log('📊 Watch the worker logs to see:');
    console.log('   - Multi-depth crawling');
    console.log('   - Content extraction (HTML to Markdown)');
    console.log('   - Storage upload (HTML and Markdown files)');
    console.log('\n🔍 You can monitor progress by running:');
    console.log('   node scripts/check-crawled-data.js');
    console.log('   node scripts/check-storage-content.js');
    console.log('\n⏰ This test crawl will:');
    console.log(`   - Crawl ${rootUrl} (depth 0)`);
    console.log(`   - Follow links to depth 1 and 2`);
    console.log(`   - Stop after ${maxPages} pages total`);
    console.log(`   - Extract content and convert to Markdown`);
    console.log(`   - Upload HTML and Markdown to Supabase Storage`);
    console.log(`   - Filter URLs by ${scope} scope`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

testEnhancedCrawlerWithStorage().catch(console.error);
