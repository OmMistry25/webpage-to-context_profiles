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

async function simpleStorageCheck() {
  console.log('🔍 Simple Storage Check');
  console.log('======================');

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

    console.log(`📁 Found ${files.length} files in storage`);

    if (files.length > 0) {
      console.log('\n📄 Files:');
      files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name} (${file.metadata?.size || 0} bytes)`);
      });

      // Try to download the first file
      const firstFile = files[0];
      console.log(`\n📖 Downloading first file: ${firstFile.name}`);
      
      const { data: fileContent, error: downloadError } = await supabase.storage
        .from('crawl_data')
        .download(firstFile.name);
      
      if (downloadError) {
        console.error('❌ Error downloading file:', downloadError);
      } else {
        const text = await fileContent.text();
        console.log('✅ File downloaded successfully');
        console.log(`📄 Content length: ${text.length} characters`);
        console.log('📄 Content preview:');
        console.log(text.substring(0, 300) + (text.length > 300 ? '...' : ''));
      }
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

simpleStorageCheck().catch(console.error);
