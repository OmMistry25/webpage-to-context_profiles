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

async function checkPageContent() {
  console.log('🔍 Checking Page Content in Database');
  console.log('====================================');

  try {
    // Get the latest crawl
    const { data: crawls, error: crawlsError } = await supabase
      .from('crawls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (crawlsError) {
      console.error('❌ Error fetching crawls:', crawlsError);
      return;
    }

    if (!crawls || crawls.length === 0) {
      console.log('No crawls found.');
      return;
    }

    const latestCrawl = crawls[0];
    console.log(`📊 Latest Crawl: ${latestCrawl.id}`);
    console.log(`🌐 URL: ${latestCrawl.root_url}`);
    console.log(`📈 Status: ${latestCrawl.status}`);
    console.log(`📄 Pages Crawled: ${latestCrawl.pages_crawled}\n`);

    // Get a few sample pages with their content
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .eq('crawl_id', latestCrawl.id)
      .order('depth', { ascending: true })
      .limit(5);

    if (pagesError) {
      console.error('❌ Error fetching pages:', pagesError);
      return;
    }

    console.log(`📄 Sample Pages (showing first ${pages.length}):\n`);

    for (const page of pages) {
      console.log(`📄 Page: ${page.title || 'No Title'}`);
      console.log(`   URL: ${page.url}`);
      console.log(`   Depth: ${page.depth}`);
      console.log(`   Status Code: ${page.status_code}`);
      console.log(`   Content Type: ${page.content_type}`);
      console.log(`   Links Found: ${page.links ? page.links.length : 0}`);
      console.log(`   Raw HTML Path: ${page.raw_html_path || 'Not stored'}`);
      console.log(`   Markdown Path: ${page.markdown_path || 'Not stored'}`);
      
      // Check if we have any content stored in the database
      if (page.content) {
        console.log(`   Content Length: ${page.content.length} characters`);
        console.log(`   Content Preview: ${page.content.substring(0, 200)}...`);
      } else {
        console.log(`   Content: Not stored in database`);
      }
      console.log('');
    }

    // Check if we have any content in the database at all
    const { data: pagesWithContent, error: contentError } = await supabase
      .from('pages')
      .select('id, title, content')
      .eq('crawl_id', latestCrawl.id)
      .not('content', 'is', null)
      .limit(1);

    if (contentError) {
      console.error('❌ Error checking for content:', contentError);
    } else if (pagesWithContent && pagesWithContent.length > 0) {
      console.log('✅ Found pages with content stored in database!');
      console.log(`📄 Sample content from: ${pagesWithContent[0].title}`);
      console.log('Content preview:');
      console.log(pagesWithContent[0].content.substring(0, 500) + '...');
    } else {
      console.log('❌ No content found in database - content is not being stored');
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkPageContent().catch(console.error);
