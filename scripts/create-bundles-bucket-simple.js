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

async function createBundlesBucket() {
  console.log('🔧 Creating Bundles Storage Bucket');
  console.log('==================================');

  try {
    // Try to create the bucket with minimal configuration
    const { data, error } = await supabase.storage.createBucket('bundles', {
      public: true
    });

    if (error) {
      console.error('❌ Error creating bucket:', error);
      
      // Check if bucket already exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets.some(bucket => bucket.name === 'bundles');
      
      if (bucketExists) {
        console.log('✅ Bucket "bundles" already exists');
      } else {
        console.log('❌ Failed to create bucket and it does not exist');
        return;
      }
    } else {
      console.log('✅ Bucket "bundles" created successfully');
    }

    console.log('\n🎉 Bundles bucket is ready!');
    console.log('📦 Bucket: bundles');
    console.log('🌐 Access: Public');

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

createBundlesBucket().catch(console.error);
