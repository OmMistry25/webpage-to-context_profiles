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

async function checkStorageContent() {
  console.log('🔍 Checking Supabase Storage Content');
  console.log('===================================');

  try {
    // List all files in the crawl_data bucket
    const { data: files, error } = await supabase.storage
      .from('crawl_data')
      .list('', {
        limit: 100,
        offset: 0,
      });

    if (error) {
      console.error('❌ Error listing storage files:', error);
      return;
    }

    if (!files || files.length === 0) {
      console.log('📁 No files found in storage.');
      return;
    }

    console.log(`📁 Found ${files.length} files in storage:\n`);

    // Group files by crawl
    const filesByCrawl = {};
    for (const file of files) {
      const pathParts = file.name.split('/');
      if (pathParts.length >= 2) {
        const crawlId = pathParts[1];
        if (!filesByCrawl[crawlId]) {
          filesByCrawl[crawlId] = { html: [], markdown: [] };
        }
        
        if (file.name.endsWith('.html')) {
          filesByCrawl[crawlId].html.push(file);
        } else if (file.name.endsWith('.md')) {
          filesByCrawl[crawlId].markdown.push(file);
        }
      }
    }

    // Display files by crawl
    for (const [crawlId, files] of Object.entries(filesByCrawl)) {
      console.log(`📊 Crawl: ${crawlId}`);
      console.log(`   📄 HTML files: ${files.html.length}`);
      console.log(`   📝 Markdown files: ${files.markdown.length}`);
      
      if (files.html.length > 0) {
        console.log('   📄 Sample HTML files:');
        files.html.slice(0, 3).forEach(file => {
          console.log(`     - ${file.name} (${(file.metadata?.size || 0)} bytes)`);
        });
        if (files.html.length > 3) {
          console.log(`     ... and ${files.html.length - 3} more HTML files`);
        }
      }
      
      if (files.markdown.length > 0) {
        console.log('   📝 Sample Markdown files:');
        files.markdown.slice(0, 3).forEach(file => {
          console.log(`     - ${file.name} (${(file.metadata?.size || 0)} bytes)`);
        });
        if (files.markdown.length > 3) {
          console.log(`     ... and ${files.markdown.length - 3} more Markdown files`);
        }
      }
      console.log('');
    }

    // Try to download and show a sample markdown file
    if (files.some(f => f.name.endsWith('.md'))) {
      const sampleMarkdownFile = files.find(f => f.name.endsWith('.md'));
      console.log(`📖 Sample Markdown Content from: ${sampleMarkdownFile.name}`);
      console.log('=====================================');
      
      const { data: markdownContent, error: downloadError } = await supabase.storage
        .from('crawl_data')
        .download(sampleMarkdownFile.name);
      
      if (downloadError) {
        console.error('❌ Error downloading markdown file:', downloadError);
      } else {
        const text = await markdownContent.text();
        console.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      }
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkStorageContent().catch(console.error);
