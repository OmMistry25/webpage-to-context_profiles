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

async function analyzeAllCrawls() {
  console.log('🔍 Analyzing All Recent Crawls');
  console.log('==============================');

  try {
    // Get the last 5 crawls
    const { data: crawls, error: crawlsError } = await supabase
      .from('crawls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (crawlsError) {
      console.error('❌ Error fetching crawls:', crawlsError);
      return;
    }

    if (!crawls || crawls.length === 0) {
      console.log('❌ No crawls found');
      return;
    }

    console.log(`📊 Found ${crawls.length} recent crawls\n`);

    for (let i = 0; i < crawls.length; i++) {
      const crawl = crawls[i];
      console.log(`🌐 Crawl ${i + 1}: ${crawl.root_url}`);
      console.log(`   📈 Status: ${crawl.status}`);
      console.log(`   📊 Scope: ${crawl.scope}, Max Depth: ${crawl.max_depth}, Max Pages: ${crawl.max_pages}`);
      console.log(`   📄 Pages Crawled: ${crawl.pages_crawled}`);
      console.log(`   ❌ Pages Failed: ${crawl.pages_failed}`);
      console.log(`   ⏰ Started: ${crawl.started_at || 'N/A'}`);
      console.log(`   ✅ Completed: ${crawl.completed_at || 'N/A'}`);
      console.log('');

      // Get pages for this crawl
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('*')
        .eq('crawl_id', crawl.id)
        .order('depth', { ascending: true });

      if (pagesError) {
        console.error(`❌ Error fetching pages for crawl ${crawl.id}:`, pagesError);
        continue;
      }

      if (pages && pages.length > 0) {
        console.log(`   📄 Pages found: ${pages.length}`);
        
        // Group pages by depth
        const pagesByDepth = {};
        pages.forEach(page => {
          if (!pagesByDepth[page.depth]) {
            pagesByDepth[page.depth] = [];
          }
          pagesByDepth[page.depth].push(page);
        });

        // Show pages by depth
        Object.keys(pagesByDepth).sort((a, b) => parseInt(a) - parseInt(b)).forEach(depth => {
          const pagesAtDepth = pagesByDepth[depth];
          console.log(`   📊 Depth ${depth}: ${pagesAtDepth.length} pages`);
          
          pagesAtDepth.forEach((page, index) => {
            console.log(`      ${index + 1}. ${page.title || 'No title'}`);
            console.log(`         URL: ${page.url}`);
            console.log(`         Status: ${page.status_code}`);
            console.log(`         Links Found: ${page.links ? page.links.length : 0}`);
            if (page.links && page.links.length > 0 && depth === '0') {
              console.log(`         Sample Links:`);
              page.links.slice(0, 3).forEach(link => {
                console.log(`           - ${link}`);
              });
              if (page.links.length > 3) {
                console.log(`           ... and ${page.links.length - 3} more`);
              }
            }
          });
        });
      } else {
        console.log(`   📄 No pages found for this crawl`);
      }
      
      console.log('');
      console.log('─'.repeat(80));
      console.log('');
    }

    // Summary analysis
    console.log('📊 CRAWLING ANALYSIS SUMMARY');
    console.log('============================');
    
    const totalPages = crawls.reduce((sum, crawl) => sum + (crawl.pages_crawled || 0), 0);
    const totalFailed = crawls.reduce((sum, crawl) => sum + (crawl.pages_failed || 0), 0);
    const successfulCrawls = crawls.filter(crawl => crawl.status === 'completed').length;
    
    console.log(`✅ Total Crawls: ${crawls.length}`);
    console.log(`✅ Successful Crawls: ${successfulCrawls}`);
    console.log(`📄 Total Pages Crawled: ${totalPages}`);
    console.log(`❌ Total Pages Failed: ${totalFailed}`);
    console.log('');
    
    console.log('🔍 CRAWLING DEPTH ANALYSIS:');
    console.log('Current crawler only crawls the ROOT page (depth 0)');
    console.log('It extracts links but does NOT follow them to crawl sub-pages');
    console.log('This is a single-page crawler, not a multi-depth crawler');
    console.log('');
    
    console.log('🚀 TO IMPLEMENT MULTI-DEPTH CRAWLING:');
    console.log('1. The worker needs to be enhanced to follow extracted links');
    console.log('2. It should respect max_depth and max_pages limits');
    console.log('3. It should implement proper URL filtering and deduplication');
    console.log('4. It should handle different scopes (domain, subdomain, path)');

  } catch (error) {
    console.error('❌ Error analyzing crawls:', error.message);
  }
}

analyzeAllCrawls();
