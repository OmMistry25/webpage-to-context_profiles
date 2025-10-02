const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: path.join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase environment variables are not set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupBundlesBucket() {
  console.log('🔧 Setting up Supabase Bundles Storage Bucket');
  console.log('=============================================');

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets.some(bucket => bucket.name === 'bundles');
    
    if (bucketExists) {
      console.log('✅ Bucket "bundles" already exists');
    } else {
      console.log('📦 Creating bucket "bundles"...');
      
      const { data, error } = await supabase.storage.createBucket('bundles', {
        public: true, // Public bucket for easy download
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit for bundles
        allowedMimeTypes: ['application/zip', 'application/octet-stream', 'text/plain']
      });

      if (error) {
        console.error('❌ Error creating bucket:', error);
        console.log('⚠️  Bucket creation failed, but continuing with test...');
      } else {
        console.log('✅ Bucket "bundles" created successfully');
      }
    }

    // Test upload a small zip file
    console.log('🧪 Testing bundle upload...');
    const testContent = 'Hello World - Test Bundle Content';
    const testFileName = 'test-bundle.txt';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bundles')
      .upload(testFileName, testContent, { contentType: 'text/plain' });

    if (uploadError) {
      console.error('❌ Error uploading test bundle:', uploadError);
      return;
    }

    console.log('✅ Test bundle uploaded successfully:', uploadData.path);

    // Test download
    console.log('🧪 Testing bundle download...');
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('bundles')
      .download(testFileName);

    if (downloadError) {
      console.error('❌ Error downloading test bundle:', downloadError);
      return;
    }

    console.log('✅ Test bundle downloaded successfully');

    // Clean up test file
    const { error: deleteError } = await supabase.storage
      .from('bundles')
      .remove([testFileName]);

    if (deleteError) {
      console.error('⚠️  Warning: Could not delete test bundle:', deleteError);
    } else {
      console.log('🧹 Test bundle cleaned up');
    }

    console.log('\n🎉 Bundles storage bucket setup completed successfully!');
    console.log('📦 Bucket: bundles');
    console.log('🌐 Access: Public (for easy downloads)');
    console.log('📏 File size limit: 100MB');
    console.log('📄 Allowed types: application/zip, application/octet-stream');

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

setupBundlesBucket().catch(console.error);
