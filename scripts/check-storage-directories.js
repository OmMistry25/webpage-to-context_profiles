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

async function checkStorageDirectories() {
  console.log('🔍 Checking Storage Directory Structure');
  console.log('======================================');

  try {
    // List root directory
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('crawl_data')
      .list('', {
        limit: 100,
        offset: 0,
      });

    if (rootError) {
      console.error('❌ Error listing root directory:', rootError);
      return;
    }

    console.log('📁 Root directory contents:');
    rootFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name} (${file.metadata?.size || 0} bytes)`);
    });

    // Check if there's a crawls directory
    const crawlsDir = rootFiles.find(f => f.name === 'crawls');
    if (crawlsDir) {
      console.log('\n📁 Checking crawls directory...');
      
      const { data: crawlsFiles, error: crawlsError } = await supabase.storage
        .from('crawl_data')
        .list('crawls', {
          limit: 100,
          offset: 0,
        });

      if (crawlsError) {
        console.error('❌ Error listing crawls directory:', crawlsError);
      } else {
        console.log(`📁 Found ${crawlsFiles.length} items in crawls directory:`);
        crawlsFiles.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.name} (${file.metadata?.size || 0} bytes)`);
        });

        // Check the first crawl directory
        if (crawlsFiles.length > 0) {
          const firstCrawl = crawlsFiles[0];
          console.log(`\n📁 Checking crawl directory: ${firstCrawl.name}`);
          
          const { data: crawlFiles, error: crawlError } = await supabase.storage
            .from('crawl_data')
            .list(`crawls/${firstCrawl.name}`, {
              limit: 100,
              offset: 0,
            });

          if (crawlError) {
            console.error('❌ Error listing crawl directory:', crawlError);
          } else {
            console.log(`📁 Found ${crawlFiles.length} items in crawl directory:`);
            crawlFiles.forEach((file, index) => {
              console.log(`   ${index + 1}. ${file.name} (${file.metadata?.size || 0} bytes)`);
            });

            // Check pages directory
            const pagesDir = crawlFiles.find(f => f.name === 'pages');
            if (pagesDir) {
              console.log(`\n📁 Checking pages directory...`);
              
              const { data: pagesFiles, error: pagesError } = await supabase.storage
                .from('crawl_data')
                .list(`crawls/${firstCrawl.name}/pages`, {
                  limit: 100,
                  offset: 0,
                });

              if (pagesError) {
                console.error('❌ Error listing pages directory:', pagesError);
              } else {
                console.log(`📁 Found ${pagesFiles.length} files in pages directory:`);
                pagesFiles.forEach((file, index) => {
                  console.log(`   ${index + 1}. ${file.name} (${file.metadata?.size || 0} bytes)`);
                });

                // Try to download the first file
                if (pagesFiles.length > 0) {
                  const firstFile = pagesFiles[0];
                  console.log(`\n📖 Downloading first file: ${firstFile.name}`);
                  
                  const { data: fileContent, error: downloadError } = await supabase.storage
                    .from('crawl_data')
                    .download(`crawls/${firstCrawl.name}/pages/${firstFile.name}`);
                  
                  if (downloadError) {
                    console.error('❌ Error downloading file:', downloadError);
                  } else {
                    const text = await fileContent.text();
                    console.log('✅ File downloaded successfully');
                    console.log(`📄 Content length: ${text.length} characters`);
                    console.log('📄 Content preview:');
                    console.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
                  }
                }
              }
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkStorageDirectories().catch(console.error);
