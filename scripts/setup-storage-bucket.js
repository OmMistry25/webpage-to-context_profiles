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

async function setupStorageBucket() {
  console.log('🔧 Setting up Supabase Storage Bucket');
  console.log('=====================================');

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets.some(bucket => bucket.name === 'crawl_data');
    
    if (bucketExists) {
      console.log('✅ Bucket "crawl_data" already exists');
    } else {
      console.log('📦 Creating bucket "crawl_data"...');
      
      const { data, error } = await supabase.storage.createBucket('crawl_data', {
        public: false, // Private bucket
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
        allowedMimeTypes: ['text/html', 'text/markdown', 'text/plain']
      });

      if (error) {
        console.error('❌ Error creating bucket:', error);
        return;
      }

      console.log('✅ Bucket "crawl_data" created successfully');
    }

    // Test upload a small file
    console.log('🧪 Testing file upload...');
    const testContent = '# Test Markdown Content\n\nThis is a test file to verify storage is working.';
    const testFileName = 'test/test-file.md';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('crawl_data')
      .upload(testFileName, testContent, { contentType: 'text/markdown' });

    if (uploadError) {
      console.error('❌ Error uploading test file:', uploadError);
      return;
    }

    console.log('✅ Test file uploaded successfully:', uploadData.path);

    // Test download
    console.log('🧪 Testing file download...');
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('crawl_data')
      .download(testFileName);

    if (downloadError) {
      console.error('❌ Error downloading test file:', downloadError);
      return;
    }

    const downloadedContent = await downloadData.text();
    console.log('✅ Test file downloaded successfully');
    console.log('📄 Downloaded content:', downloadedContent);

    // Clean up test file
    const { error: deleteError } = await supabase.storage
      .from('crawl_data')
      .remove([testFileName]);

    if (deleteError) {
      console.error('⚠️  Warning: Could not delete test file:', deleteError);
    } else {
      console.log('🧹 Test file cleaned up');
    }

    console.log('\n🎉 Storage bucket setup completed successfully!');
    console.log('📦 Bucket: crawl_data');
    console.log('🔒 Access: Private (requires authentication)');
    console.log('📏 File size limit: 50MB');
    console.log('📄 Allowed types: text/html, text/markdown, text/plain');

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

setupStorageBucket().catch(console.error);
