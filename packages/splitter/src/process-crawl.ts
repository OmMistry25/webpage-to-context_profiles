#!/usr/bin/env node

import TokenAwareSplitter from './index.js'

async function processRecentCrawl() {
  console.log('🔄 Processing Recent Crawl for Chunking')
  console.log('======================================')

  const splitter = new TokenAwareSplitter({
    maxTokens: 1000,
    overlapTokens: 100,
    minTokens: 50
  })

  try {
    // Get the most recent crawl that has pages with markdown content
    const { createClient } = await import('@supabase/supabase-js')
    const { config } = await import('dotenv')
    const path = await import('path')
    const { fileURLToPath } = await import('url')

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find a crawl with pages that have markdown content
    const { data: crawls, error: crawlsError } = await supabase
      .from('crawls')
      .select(`
        id,
        root_url,
        status,
        pages!inner(
          id,
          title,
          url,
          markdown_path
        )
      `)
      .not('pages.markdown_path', 'is', null)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)

    if (crawlsError) {
      console.error('❌ Error fetching crawls:', crawlsError)
      return
    }

    if (!crawls || crawls.length === 0) {
      console.log('⏭️  No completed crawls with markdown content found')
      return
    }

    const crawl = crawls[0]
    console.log(`📊 Found crawl: ${crawl.root_url}`)
    console.log(`🆔 Crawl ID: ${crawl.id}`)
    console.log(`📄 Pages with markdown: ${crawl.pages.length}`)
    console.log()

    // Process the crawl
    await splitter.processCrawl(crawl.id)

  } catch (error) {
    console.error('❌ Error processing crawl:', error)
  }
}

processRecentCrawl().catch(console.error)
