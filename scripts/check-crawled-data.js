#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCrawledData() {
  console.log('🔍 Checking Crawled Data');
  console.log('========================');

  try {
    // Get the most recent crawl
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
      console.log('❌ No crawls found');
      return;
    }

    const crawl = crawls[0];
    console.log(`📊 Latest Crawl: ${crawl.id}`);
    console.log(`🌐 URL: ${crawl.root_url}`);
    console.log(`📈 Status: ${crawl.status}`);
    console.log(`📄 Pages Crawled: ${crawl.pages_crawled}`);
    console.log(`❌ Pages Failed: ${crawl.pages_failed}`);
    console.log('');

    // Get pages for this crawl
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .eq('crawl_id', crawl.id)
      .order('created_at', { ascending: false });

    if (pagesError) {
      console.error('❌ Error fetching pages:', pagesError);
      return;
    }

    console.log(`📄 Pages found: ${pages?.length || 0}`);
    console.log('');

    if (pages && pages.length > 0) {
      pages.forEach((page, index) => {
        console.log(`📄 Page ${index + 1}:`);
        console.log(`   URL: ${page.url}`);
        console.log(`   Title: ${page.title || 'No title'}`);
        console.log(`   Status Code: ${page.status_code || 'N/A'}`);
        console.log(`   Content Type: ${page.content_type || 'N/A'}`);
        console.log(`   Depth: ${page.depth}`);
        console.log(`   Crawled At: ${page.crawled_at || 'N/A'}`);
        console.log(`   Links Found: ${page.links ? page.links.length : 0}`);
        if (page.links && page.links.length > 0) {
          console.log(`   Sample Links:`);
          page.links.slice(0, 3).forEach(link => {
            console.log(`     - ${link}`);
          });
          if (page.links.length > 3) {
            console.log(`     ... and ${page.links.length - 3} more`);
          }
        }
        console.log('');
      });
    }

    // Get jobs for this crawl
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .eq('payload->>crawl_id', crawl.id)
      .order('created_at', { ascending: false });

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError);
    } else {
      console.log(`🔧 Jobs found: ${jobs?.length || 0}`);
      if (jobs && jobs.length > 0) {
        jobs.forEach((job, index) => {
          console.log(`   Job ${index + 1}: ${job.id} - ${job.status}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error checking crawled data:', error.message);
  }
}

checkCrawledData();
